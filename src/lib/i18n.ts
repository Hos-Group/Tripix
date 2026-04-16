/**
 * i18n.ts — Tripix multilingual translations
 * Supported languages: Hebrew (he), English (en), Spanish (es)
 */

export type Lang = 'he' | 'en' | 'es'

export const LANG_META: Record<Lang, { label: string; flag: string; dir: 'rtl' | 'ltr'; nativeName: string }> = {
  he: { label: 'עברית',   flag: '🇮🇱', dir: 'rtl', nativeName: 'עברית'   },
  en: { label: 'English', flag: '🇺🇸', dir: 'ltr', nativeName: 'English'  },
  es: { label: 'Español', flag: '🇪🇸', dir: 'ltr', nativeName: 'Español'  },
}

export const translations = {
  // ─────────────────────────────── Navigation ──────────────────────────────────
  nav_home:         { he: 'ראשי',      en: 'Home',       es: 'Inicio'      },
  nav_expenses:     { he: 'הוצאות',    en: 'Expenses',   es: 'Gastos'      },
  nav_scan:         { he: 'סרוק',      en: 'Scan',       es: 'Escanear'    },
  nav_documents:    { he: 'מסמכים',    en: 'Documents',  es: 'Documentos'  },
  nav_timeline:     { he: 'ציר זמן',   en: 'Timeline',   es: 'Cronología'  },

  // ─────────────────────────────── Hamburger Menu ──────────────────────────────
  menu_new_trip:        { he: 'צור נסיעה חדשה',     en: 'New Trip',              es: 'Nuevo Viaje'          },
  menu_my_trips:        { he: 'הנסיעות שלי',         en: 'My Trips',              es: 'Mis Viajes'           },
  menu_ai_assistant:    { he: 'עוזר AI חכם',         en: 'Smart AI Assistant',    es: 'Asistente IA'         },
  menu_itinerary:       { he: 'לוח מסע',             en: 'Itinerary',             es: 'Itinerario'           },
  menu_budget:          { he: 'מעקב תקציב',          en: 'Budget Tracking',       es: 'Presupuesto'          },
  menu_packing:         { he: 'רשימת אריזה',         en: 'Packing List',          es: 'Lista de Equipaje'    },
  menu_lifestyle:       { he: 'LifeStyle',            en: 'LifeStyle',             es: 'LifeStyle'            },
  menu_weather:         { he: 'מזג אוויר',            en: 'Weather',               es: 'Clima'                },
  menu_tools:           { he: 'כלים (המרה / טיפ)',   en: 'Tools (FX / Tip)',      es: 'Herramientas'         },
  menu_emergency:       { he: 'מצב חירום',            en: 'Emergency',             es: 'Emergencia'           },
  menu_shared_trips:    { he: 'נסיעות משותפות',      en: 'Shared Trips',          es: 'Viajes Compartidos'   },
  menu_community:       { he: 'קהילת Tripix',         en: 'Tripix Community',      es: 'Comunidad Tripix'     },
  menu_places:          { he: 'המלצות מקומות',        en: 'Place Recommendations', es: 'Recomendaciones'      },
  menu_partners:        { he: 'eSIM וביטוח',          en: 'eSIM & Insurance',      es: 'eSIM y Seguro'        },
  menu_trip_tools:      { he: 'כלי נסיעה',            en: 'Trip Tools',            es: 'Herramientas de Viaje'},
  menu_general:         { he: 'כללי',                 en: 'General',               es: 'General'              },

  // ─────────────────────────────── Dashboard ───────────────────────────────────
  dash_title:           { he: 'ראשי',                 en: 'Dashboard',             es: 'Principal'            },
  dash_my_trip:         { he: 'הנסיעה שלי',           en: 'My Trip',               es: 'Mi Viaje'             },
  dash_budget:          { he: 'תקציב',                en: 'Budget',                es: 'Presupuesto'          },
  dash_expenses:        { he: 'הוצאות',               en: 'Expenses',              es: 'Gastos'               },
  dash_travel_days:     { he: 'ימי נסיעה',            en: 'Travel Days',           es: 'Días de Viaje'        },
  dash_upcoming:        { he: 'אירועים קרובים',       en: 'Upcoming Events',       es: 'Próximos Eventos'     },
  dash_no_trip:         { he: 'בחר נסיעה',            en: 'Select a Trip',         es: 'Selecciona un Viaje'  },
  dash_first_trip:      { he: 'צור נסיעה ראשונה',     en: 'Create First Trip',     es: 'Crear Primer Viaje'   },
  dash_days_left:       { he: 'ימים לנסיעה',          en: 'Days to Trip',          es: 'Días para el Viaje'   },
  dash_trip_ongoing:    { he: 'הנסיעה בעיצומה!',      en: 'Trip in Progress!',     es: '¡Viaje en curso!'     },
  dash_trip_ended:      { he: 'הנסיעה הסתיימה',       en: 'Trip Ended',            es: 'Viaje Terminado'      },
  dash_all_trips:       { he: 'כל הנסיעות',           en: 'All Trips',             es: 'Todos los Viajes'     },
  dash_day:             { he: 'יום',                  en: 'Day',                   es: 'Día'                  },
  dash_spent:           { he: 'הוצא',                 en: 'Spent',                 es: 'Gastado'              },
  dash_remaining:       { he: 'נשאר',                 en: 'Remaining',             es: 'Restante'             },
  dash_ready:           { he: 'מוכן לנסיעה הראשונה?', en: 'Ready for your first trip?', es: '¿Listo para tu primer viaje?' },

  // ─────────────────────────────── Expenses ────────────────────────────────────
  exp_title:            { he: 'הוצאות',               en: 'Expenses',              es: 'Gastos'               },
  exp_add:              { he: 'הוסף הוצאה',           en: 'Add Expense',           es: 'Agregar Gasto'        },
  exp_search:           { he: 'חיפוש...',             en: 'Search...',             es: 'Buscar...'            },
  exp_all_categories:   { he: 'הכל',                  en: 'All',                   es: 'Todo'                 },
  exp_name:             { he: 'שם ההוצאה',            en: 'Expense Name',          es: 'Nombre del Gasto'     },
  exp_category:         { he: 'קטגוריה',              en: 'Category',              es: 'Categoría'            },
  exp_amount:           { he: 'סכום',                 en: 'Amount',                es: 'Monto'                },
  exp_date:             { he: 'תאריך',                en: 'Date',                  es: 'Fecha'                },
  exp_notes:            { he: 'הערות',                en: 'Notes',                 es: 'Notas'                },
  exp_currency:         { he: 'מטבע',                 en: 'Currency',              es: 'Moneda'               },
  exp_no_expenses:      { he: 'אין הוצאות עדיין',     en: 'No expenses yet',       es: 'Sin gastos aún'       },
  exp_total:            { he: 'סה"כ',                 en: 'Total',                 es: 'Total'                },
  exp_confirm_delete:   { he: 'אתה בטוח שאתה רוצה למחוק?', en: 'Are you sure you want to delete?', es: '¿Seguro que deseas eliminar?' },
  exp_saved:            { he: 'ההוצאה נשמרה!',        en: 'Expense saved!',        es: '¡Gasto guardado!'     },
  exp_deleted:          { he: 'נמחק',                 en: 'Deleted',               es: 'Eliminado'            },
  exp_error_save:       { he: 'שגיאה בשמירה',         en: 'Error saving',          es: 'Error al guardar'     },
  exp_error_delete:     { he: 'שגיאה במחיקה',         en: 'Error deleting',        es: 'Error al eliminar'    },
  exp_fill_required:    { he: 'נא למלא שם, סכום ותאריך', en: 'Please fill name, amount and date', es: 'Completa nombre, monto y fecha' },
  exp_select_trip:      { he: 'בחר נסיעה קודם',       en: 'Select a trip first',   es: 'Selecciona un viaje primero' },
  exp_in_ils:           { he: 'בשקלים',               en: 'In ILS',                es: 'En ILS'               },

  // ─────────────────────────────── Documents ───────────────────────────────────
  doc_title:            { he: 'מסמכים',               en: 'Documents',             es: 'Documentos'           },
  doc_add:              { he: 'הוסף מסמך',            en: 'Add Document',          es: 'Agregar Documento'    },
  doc_no_docs:          { he: 'אין מסמכים עדיין',     en: 'No documents yet',      es: 'Sin documentos aún'   },
  doc_scan_email:       { he: 'סרוק מייל',            en: 'Scan Email',            es: 'Escanear Email'       },
  doc_upload:           { he: 'העלה קובץ',            en: 'Upload File',           es: 'Subir Archivo'        },
  doc_no_trip:          { he: 'לא נבחרה נסיעה',       en: 'No trip selected',      es: 'Ningún viaje seleccionado' },

  // ─────────────────────────────── Timeline ────────────────────────────────────
  timeline_title:       { he: 'ציר זמן',              en: 'Timeline',              es: 'Cronología'           },
  timeline_view:        { he: 'ציר זמן',              en: 'Timeline',              es: 'Cronología'           },
  timeline_summary:     { he: 'סיכום',                en: 'Summary',               es: 'Resumen'              },
  timeline_day:         { he: 'יום',                  en: 'Day',                   es: 'Día'                  },
  timeline_before_trip: { he: 'לפני הנסיעה',          en: 'Before Trip',           es: 'Antes del Viaje'      },
  timeline_no_events:   { he: 'אין אירועים',           en: 'No events',             es: 'Sin eventos'          },
  timeline_empty:       { he: 'ציר הזמן ריק',         en: 'Timeline is empty',     es: 'Cronología vacía'     },

  // ─────────────────────────────── Trips ───────────────────────────────────────
  trips_title:          { he: 'הנסיעות שלי',          en: 'My Trips',              es: 'Mis Viajes'           },
  trips_new:            { he: 'נסיעה חדשה',           en: 'New Trip',              es: 'Nuevo Viaje'          },
  trips_create_new:     { he: 'צור נסיעה חדשה',       en: 'Create New Trip',       es: 'Crear Nuevo Viaje'    },
  trips_no_trips:       { he: 'עדיין אין נסיעות',     en: 'No trips yet',          es: 'Sin viajes aún'       },
  trips_create_first:   { he: 'צור נסיעה ראשונה',     en: 'Create First Trip',     es: 'Crear Primer Viaje'   },
  trips_deleted:        { he: 'הנסיעה נמחקה',         en: 'Trip deleted',          es: 'Viaje eliminado'      },
  trips_delete_title:   { he: 'מחיקת נסיעה',          en: 'Delete Trip',           es: 'Eliminar Viaje'       },
  trips_delete_confirm: { he: 'האם אתה בטוח?',        en: 'Are you sure?',         es: '¿Estás seguro?'       },
  trips_active:         { he: 'פעיל',                 en: 'Active',                es: 'Activo'               },
  trips_days:           { he: 'ימים',                 en: 'Days',                  es: 'Días'                 },
  trips_name:           { he: 'שם הנסיעה',            en: 'Trip Name',             es: 'Nombre del Viaje'     },
  trips_destination:    { he: 'יעד',                  en: 'Destination',           es: 'Destino'              },
  trips_dates:          { he: 'תאריכים',              en: 'Dates',                 es: 'Fechas'               },
  trips_travelers:      { he: 'נוסעים',               en: 'Travelers',             es: 'Viajeros'             },
  trips_budget:         { he: 'תקציב',                en: 'Budget',                es: 'Presupuesto'          },
  trips_created:        { he: 'הנסיעה נוצרה',         en: 'Trip created',          es: 'Viaje creado'         },

  // ─────────────────────────────── Settings ────────────────────────────────────
  settings_title:       { he: 'הגדרות',               en: 'Settings',              es: 'Configuración'        },
  settings_language:    { he: 'שפה',                  en: 'Language',              es: 'Idioma'               },
  settings_language_desc:{ he: 'בחר את שפת הממשק',   en: 'Choose interface language', es: 'Elige el idioma'  },
  settings_account:     { he: 'פרטי חשבון',           en: 'Account Details',       es: 'Detalles de Cuenta'   },
  settings_travelers:   { he: 'נוסעים קבועים',        en: 'Regular Travelers',     es: 'Viajeros Habituales'  },
  settings_currency:    { he: 'מטבע ברירת מחדל',     en: 'Default Currency',      es: 'Moneda Predeterminada'},
  settings_email:       { he: 'חיבור מייל חכם',      en: 'Smart Email Connect',   es: 'Conexión Email'       },
  settings_gmail:       { he: 'סנכרון Gmail',         en: 'Gmail Sync',            es: 'Sincronizar Gmail'    },
  settings_notifications:{ he: 'התראות',              en: 'Notifications',         es: 'Notificaciones'       },
  settings_security:    { he: 'אבטחה ופרטיות',       en: 'Security & Privacy',    es: 'Seguridad y Privacidad'},
  settings_about:       { he: 'אודות',                en: 'About',                 es: 'Acerca de'            },
  settings_logout:      { he: 'התנתקות',              en: 'Log Out',               es: 'Cerrar Sesión'        },
  settings_save:        { he: 'שמור שינויים',         en: 'Save Changes',          es: 'Guardar Cambios'      },
  settings_saved:       { he: 'נשמר בהצלחה',         en: 'Saved successfully',    es: 'Guardado exitosamente'},

  // ─────────────────────────────── Common Actions ──────────────────────────────
  save:                 { he: 'שמור',                 en: 'Save',                  es: 'Guardar'              },
  cancel:               { he: 'ביטול',                en: 'Cancel',                es: 'Cancelar'             },
  delete:               { he: 'מחק',                  en: 'Delete',                es: 'Eliminar'             },
  add:                  { he: 'הוסף',                 en: 'Add',                   es: 'Agregar'              },
  edit:                 { he: 'ערוך',                 en: 'Edit',                  es: 'Editar'               },
  confirm:              { he: 'אישור',                en: 'Confirm',               es: 'Confirmar'            },
  back:                 { he: 'חזור',                 en: 'Back',                  es: 'Volver'               },
  close:                { he: 'סגור',                 en: 'Close',                 es: 'Cerrar'               },
  loading:              { he: 'טוען...',              en: 'Loading...',            es: 'Cargando...'          },
  error:                { he: 'שגיאה',                en: 'Error',                 es: 'Error'                },
  retry:                { he: 'נסה שוב',              en: 'Try Again',             es: 'Intentar de Nuevo'    },
  search:               { he: 'חיפוש',               en: 'Search',                es: 'Buscar'               },
  filter:               { he: 'סינון',               en: 'Filter',                es: 'Filtrar'              },
  all:                  { he: 'הכל',                  en: 'All',                   es: 'Todo'                 },
  yes:                  { he: 'כן',                   en: 'Yes',                   es: 'Sí'                   },
  no:                   { he: 'לא',                   en: 'No',                    es: 'No'                   },
  from:                 { he: 'מ-',                   en: 'From',                  es: 'Desde'                },
  to:                   { he: 'עד',                   en: 'To',                    es: 'Hasta'                },
  total:                { he: 'סה"כ',                 en: 'Total',                 es: 'Total'                },

  // ─────────────────────────────── Categories ──────────────────────────────────
  cat_flight:       { he: 'טיסה',           en: 'Flight',         es: 'Vuelo'           },
  cat_train:        { he: 'רכבת',           en: 'Train',          es: 'Tren'            },
  cat_ferry:        { he: 'מעבורת',         en: 'Ferry',          es: 'Ferry'           },
  cat_taxi:         { he: 'מונית / Uber',   en: 'Taxi / Uber',    es: 'Taxi / Uber'     },
  cat_car_rental:   { he: 'השכרת רכב',      en: 'Car Rental',     es: 'Alquiler de Auto'},
  cat_parking:      { he: 'חניה',           en: 'Parking',        es: 'Estacionamiento' },
  cat_hotel:        { he: 'לינה',           en: 'Accommodation',  es: 'Alojamiento'     },
  cat_activity:     { he: 'פעילות / סיור', en: 'Activity / Tour',es: 'Actividad / Tour'},
  cat_museum:       { he: 'מוזיאון / תרבות',en: 'Museum / Culture',es:'Museo / Cultura' },
  cat_sport:        { he: 'ספורט',          en: 'Sport',          es: 'Deporte'         },
  cat_nightlife:    { he: 'בילוי לילי',     en: 'Nightlife',      es: 'Vida Nocturna'   },
  cat_spa:          { he: 'ספא / בריאות',  en: 'Spa / Wellness', es: 'Spa / Bienestar' },
  cat_food:         { he: 'אוכל ושתייה',   en: 'Food & Drink',   es: 'Comida y Bebida' },
  cat_shopping:     { he: 'קניות',          en: 'Shopping',       es: 'Compras'         },
  cat_travel_gear:  { he: 'ציוד נסיעה',    en: 'Travel Gear',    es: 'Equipo de Viaje' },
  cat_pharmacy:     { he: 'בית מרקחת',      en: 'Pharmacy',       es: 'Farmacia'        },
  cat_sim:          { he: 'כרטיס SIM',      en: 'SIM Card',       es: 'Tarjeta SIM'     },
  cat_laundry:      { he: 'כביסה',          en: 'Laundry',        es: 'Lavandería'      },
  cat_insurance:    { he: 'ביטוח',          en: 'Insurance',      es: 'Seguro'          },
  cat_visa:         { he: 'ויזה / אשרה',   en: 'Visa / Permit',  es: 'Visa / Permiso'  },
  cat_tips:         { he: 'טיפים',          en: 'Tips',           es: 'Propinas'        },
  cat_other:        { he: 'אחר',            en: 'Other',          es: 'Otro'            },

  // ─────────────────────────────── Doc Types ───────────────────────────────────
  doctype_passport:  { he: 'דרכון',          en: 'Passport',       es: 'Pasaporte'       },
  doctype_flight:    { he: 'כרטיס טיסה',    en: 'Flight Ticket',  es: 'Boleto de Vuelo' },
  doctype_hotel:     { he: 'הזמנת לינה',    en: 'Hotel Booking',  es: 'Reserva de Hotel'},
  doctype_ferry:     { he: 'מעבורת',         en: 'Ferry',          es: 'Ferry'           },
  doctype_activity:  { he: 'פעילות',         en: 'Activity',       es: 'Actividad'       },
  doctype_insurance: { he: 'ביטוח',          en: 'Insurance',      es: 'Seguro'          },
  doctype_visa:      { he: 'ויזה / אשרה',   en: 'Visa / Permit',  es: 'Visa / Permiso'  },
  doctype_other:     { he: 'אחר',            en: 'Other',          es: 'Otro'            },

  // ─────────────────────────────── Scan ────────────────────────────────────────
  scan_title:        { he: 'סרוק קבלה',      en: 'Scan Receipt',   es: 'Escanear Recibo' },
  scan_take_photo:   { he: 'צלם קבלה',       en: 'Take Photo',     es: 'Tomar Foto'      },
  scan_upload:       { he: 'העלה תמונה',     en: 'Upload Image',   es: 'Subir Imagen'    },
  scan_processing:   { he: 'מעבד...',        en: 'Processing...',  es: 'Procesando...'   },

  // ─────────────────────────────── Budget ──────────────────────────────────────
  budget_title:      { he: 'תקציב',          en: 'Budget',         es: 'Presupuesto'     },
  budget_set:        { he: 'הגדר תקציב',     en: 'Set Budget',     es: 'Establecer Presupuesto' },
  budget_used:       { he: 'שומש',           en: 'Used',           es: 'Usado'           },
  budget_remaining:  { he: 'נשאר',           en: 'Remaining',      es: 'Restante'        },
  budget_over:       { he: 'חרגת מהתקציב!', en: 'Over budget!',   es: '¡Presupuesto excedido!' },

  // ─────────────────────────────── Partners ────────────────────────────────────
  partners_title:    { he: 'שותפויות ויתרונות', en: 'Partners & Benefits', es: 'Socios y Beneficios' },
  partners_esim:     { he: 'eSIM / כרטיס SIM',  en: 'eSIM / SIM Card',     es: 'eSIM / Tarjeta SIM'  },
  partners_insurance:{ he: 'ביטוח נסיעות',      en: 'Travel Insurance',    es: 'Seguro de Viaje'     },
  partners_car:      { he: 'השכרת רכב',          en: 'Car Rental',          es: 'Alquiler de Auto'    },
  partners_recommended:{ he: 'מומלץ',            en: 'Recommended',         es: 'Recomendado'         },
  partners_book:     { he: 'להזמנה באתר',        en: 'Book on Website',     es: 'Reservar en Sitio'   },

  // ─────────────────────────────── Places ──────────────────────────────────────
  places_title:      { he: 'המלצות מקומות',    en: 'Place Recommendations', es: 'Recomendaciones'    },
  places_restaurant: { he: 'מסעדות',           en: 'Restaurants',          es: 'Restaurantes'        },
  places_cafe:       { he: 'קפה',              en: 'Cafes',                es: 'Cafeterías'          },
  places_attraction: { he: 'אטרקציות',         en: 'Attractions',          es: 'Atracciones'         },
  places_beach:      { he: 'חופים',            en: 'Beaches',              es: 'Playas'              },
  places_shopping:   { he: 'קניות',            en: 'Shopping',             es: 'Compras'             },
  places_sport:      { he: 'ספורט',            en: 'Sports',               es: 'Deportes'            },
  places_nightlife:  { he: 'בילוי לילי',        en: 'Nightlife',            es: 'Vida Nocturna'       },
  places_navigate:   { he: 'ניווט במפות',       en: 'Navigate',             es: 'Navegar'             },
  places_open:       { he: 'פתוח',             en: 'Open',                 es: 'Abierto'             },
  places_closed:     { he: 'סגור',             en: 'Closed',               es: 'Cerrado'             },
  places_no_trip:    { he: 'בחר נסיעה כדי לראות המלצות', en: 'Select a trip to see recommendations', es: 'Selecciona un viaje' },
  places_empty:      { he: 'לא נמצאו מקומות',  en: 'No places found',      es: 'No se encontraron lugares' },

  // ─────────────────────────────── Weekdays ────────────────────────────────────
  day_sun:           { he: 'ראשון',            en: 'Sunday',               es: 'Domingo'             },
  day_mon:           { he: 'שני',              en: 'Monday',               es: 'Lunes'               },
  day_tue:           { he: 'שלישי',            en: 'Tuesday',              es: 'Martes'              },
  day_wed:           { he: 'רביעי',            en: 'Wednesday',            es: 'Miércoles'           },
  day_thu:           { he: 'חמישי',            en: 'Thursday',             es: 'Jueves'              },
  day_fri:           { he: 'שישי',             en: 'Friday',               es: 'Viernes'             },
  day_sat:           { he: 'שבת',              en: 'Saturday',             es: 'Sábado'              },

  // ─────────────────────────────── Assistant ───────────────────────────────────
  assistant_title:   { he: 'עוזר AI חכם',     en: 'Smart AI Assistant',   es: 'Asistente IA'        },
  assistant_placeholder: { he: 'שאל אותי כל דבר על הנסיעה...', en: 'Ask me anything about your trip...', es: 'Pregúntame sobre tu viaje...' },

  // ─────────────────────────────── Emergency ───────────────────────────────────
  emergency_title:   { he: 'מצב חירום',        en: 'Emergency',            es: 'Emergencia'          },

  // ─────────────────────────────── Weather ─────────────────────────────────────
  weather_title:     { he: 'מזג אוויר',         en: 'Weather',              es: 'Clima'               },

  // ─────────────────────────────── Packing ─────────────────────────────────────
  packing_title:     { he: 'רשימת אריזה',       en: 'Packing List',         es: 'Lista de Equipaje'   },

  // ─────────────────────────────── Months ──────────────────────────────────────
  month_jan:         { he: 'ינואר',             en: 'January',              es: 'Enero'               },
  month_feb:         { he: 'פברואר',            en: 'February',             es: 'Febrero'             },
  month_mar:         { he: 'מרץ',               en: 'March',                es: 'Marzo'               },
  month_apr:         { he: 'אפריל',             en: 'April',                es: 'Abril'               },
  month_may:         { he: 'מאי',               en: 'May',                  es: 'Mayo'                },
  month_jun:         { he: 'יוני',              en: 'June',                 es: 'Junio'               },
  month_jul:         { he: 'יולי',              en: 'July',                 es: 'Julio'               },
  month_aug:         { he: 'אוגוסט',            en: 'August',               es: 'Agosto'              },
  month_sep:         { he: 'ספטמבר',            en: 'September',            es: 'Septiembre'          },
  month_oct:         { he: 'אוקטובר',           en: 'October',              es: 'Octubre'             },
  month_nov:         { he: 'נובמבר',            en: 'November',             es: 'Noviembre'           },
  month_dec:         { he: 'דצמבר',             en: 'December',             es: 'Diciembre'           },
} satisfies Record<string, Record<Lang, string>>

export type TranslationKey = keyof typeof translations

/** Get a translated string */
export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? translations[key]?.he ?? key
}
