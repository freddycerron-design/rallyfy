const hora = new Intl.DateTimeFormat('es-419', { hour: '2-digit', minute: '2-digit' })

export const horaCorta = (iso: string) => hora.format(new Date(iso))
