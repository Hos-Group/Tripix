import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')
  const docType = searchParams.get('doc_type')
  const travelerId = searchParams.get('traveler_id')

  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (tripId) query = query.eq('trip_id', tripId)
  if (docType) query = query.eq('doc_type', docType)
  if (travelerId) query = query.eq('traveler_id', travelerId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const docData = JSON.parse(formData.get('data') as string)

  let fileUrl: string | null = null

  if (file) {
    const fileName = `${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData.path)

    fileUrl = urlData.publicUrl
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({ ...docData, file_url: fileUrl, file_type: file?.type || null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'חסר id' }, { status: 400 })
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
