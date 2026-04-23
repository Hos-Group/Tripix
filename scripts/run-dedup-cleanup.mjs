#!/usr/bin/env node
/**
 * run-dedup-cleanup.mjs — one-shot duplicate cleanup for the documents table.
 *
 * Mirrors the logic of supabase/migrations/018_dedup_cleanup.sql but runs
 * through the Supabase JS client + service role key, so it works without a
 * linked CLI or a direct Postgres connection.
 *
 * Steps (scoped per trip_id, keeps the oldest row in each group):
 *   0. Backfill `dedup_key` where missing, using the buildDedupKey() rules.
 *   1. Delete duplicates by gmail_message_id
 *   2. Delete duplicates by dedup_key
 *   3. Delete duplicates by content_hash
 *   4. Delete duplicates by idempotency_key
 *
 * Usage:
 *   DRY_RUN=1 node scripts/run-dedup-cleanup.mjs   # preview only
 *   node scripts/run-dedup-cleanup.mjs             # actually delete
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) {
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const DRY_RUN = Boolean(process.env.DRY_RUN)
const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── buildDedupKey — mirrors src/lib/documentDedup.ts ────────────────────────
function buildDedupKey(d) {
  const type      = (d.doc_type      || '').toLowerCase()
  const ref       = (d.booking_ref   || '').trim().toLowerCase()
  const traveler  = (d.traveler_id   || 'all').toLowerCase()
  const date      = (d.valid_from    || '').slice(0, 10)
  const flightNum = (d.flight_number || '').trim().toLowerCase()
  const name      = (d.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (ref) {
    if (type === 'flight') return `${type}|${ref}|${traveler}|${flightNum}|${date}`
    return `${type}|${ref}|${traveler}`
  }
  if (name && date) return `${type}|${name}|${date}|${traveler}`
  return null
}

// ── Fetch every document in small pages ─────────────────────────────────────
async function fetchAllDocs() {
  const all = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, trip_id, doc_type, booking_ref, traveler_id, valid_from, flight_number, name, gmail_message_id, dedup_key, content_hash, idempotency_key, created_at')
      .order('created_at', { ascending: true })
      .order('id',         { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── Batch DELETE by id ──────────────────────────────────────────────────────
async function deleteByIds(ids) {
  if (!ids.length) return 0
  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  let deleted = 0
  for (const chunk of chunks) {
    const { error, count } = await supabase
      .from('documents')
      .delete({ count: 'exact' })
      .in('id', chunk)
    if (error) throw error
    deleted += count || 0
  }
  return deleted
}

// ── Dedup finder — given a key function, returns victim IDs (keeps oldest) ──
function findVictims(docs, keyFn) {
  const groups = new Map()
  for (const d of docs) {
    if (!d.trip_id) continue
    const k = keyFn(d)
    if (!k) continue
    const bucket = `${d.trip_id}|${k}`
    if (!groups.has(bucket)) groups.set(bucket, [])
    groups.get(bucket).push(d)
  }
  const victims = []
  for (const [, rows] of groups) {
    if (rows.length <= 1) continue
    // docs are already sorted oldest-first by created_at, id
    for (let i = 1; i < rows.length; i++) victims.push(rows[i].id)
  }
  return victims
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[dedup-cleanup] mode=${DRY_RUN ? 'DRY RUN' : 'LIVE'} url=${URL}`)

  const docs = await fetchAllDocs()
  console.log(`[dedup-cleanup] loaded ${docs.length} document rows`)

  // ── Step 0: backfill dedup_key where missing ─────────────────────────────
  const toBackfill = []
  for (const d of docs) {
    if (d.dedup_key) continue
    const k = buildDedupKey(d)
    if (k) {
      toBackfill.push({ id: d.id, key: k })
      d.dedup_key = k   // reflect locally for the dedup step
    }
  }
  console.log(`[dedup-cleanup] backfill candidates: ${toBackfill.length}`)
  if (!DRY_RUN && toBackfill.length) {
    for (let i = 0; i < toBackfill.length; i += 500) {
      const chunk = toBackfill.slice(i, i + 500)
      // Update one-by-one is slow but safe; group by unique key is complex. Use RPC-less updates.
      await Promise.all(chunk.map(({ id, key }) =>
        supabase.from('documents').update({ dedup_key: key }).eq('id', id),
      ))
      process.stdout.write(`  backfilled ${Math.min(i + 500, toBackfill.length)} / ${toBackfill.length}\r`)
    }
    console.log(`\n[dedup-cleanup] backfill complete`)
  }

  // ── Step 1-4: find + delete duplicates ───────────────────────────────────
  const steps = [
    { name: 'gmail_message_id',  keyFn: d => d.gmail_message_id || null },
    { name: 'dedup_key',         keyFn: d => d.dedup_key        || null },
    { name: 'content_hash',      keyFn: d => d.content_hash     || null },
    { name: 'idempotency_key',   keyFn: d => d.idempotency_key  || null },
  ]

  // Track already-deleted IDs across steps so we don't re-count victims of
  // earlier passes.
  const alreadyGone = new Set()
  let docsRemaining = docs

  const report = {}
  for (const step of steps) {
    const victims = findVictims(
      docsRemaining.filter(d => !alreadyGone.has(d.id)),
      step.keyFn,
    )
    report[step.name] = victims.length

    if (!DRY_RUN && victims.length) {
      const n = await deleteByIds(victims)
      console.log(`[dedup-cleanup] step "${step.name}": deleted ${n}`)
    } else {
      console.log(`[dedup-cleanup] step "${step.name}": ${victims.length} candidate(s)${DRY_RUN ? ' (dry run)' : ''}`)
    }
    for (const id of victims) alreadyGone.add(id)
  }

  console.log('')
  console.log('── SUMMARY ──────────────────────────────────────')
  console.log(`total loaded                : ${docs.length}`)
  console.log(`backfilled dedup_key        : ${toBackfill.length}${DRY_RUN ? ' (preview)' : ''}`)
  for (const step of steps) console.log(`dup by ${step.name.padEnd(20)}: ${report[step.name]}`)
  console.log(`total would-delete (unique) : ${alreadyGone.size}`)
  console.log(`mode                        : ${DRY_RUN ? 'DRY RUN — nothing deleted' : 'LIVE — rows deleted'}`)
}

main().catch(err => {
  console.error('[dedup-cleanup] failed:', err)
  process.exit(1)
})
