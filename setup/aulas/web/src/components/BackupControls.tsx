import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { DownloadSimple, UploadSimple, X } from 'phosphor-react'
import { errorMessage } from '../lib/api'
import { exportBackup, localToday, parseBackup, restoreBackup } from '../lib/browser-api'

export function BackupControls({
  onUpdated,
  disabled,
}: {
  onUpdated: () => void
  disabled: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<{ raw: string; count: number } | null>(null)
  const [error, setError] = useState('')
  function download() {
    try {
      const blob = new Blob([exportBackup()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `habits-${localToday()}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch (error) {
      setError(errorMessage(error))
    }
  }
  async function selectFile(file?: File) {
    if (!file) return
    try {
      if (file.size > 1048576) throw new Error('O backup deve ter até 1 MB.')
      const raw = await file.text()
      const state = parseBackup(raw)
      setPending({ raw, count: state.habits.length })
      setError('')
    } catch (error) {
      setError(errorMessage(error))
    }
    if (input.current) input.current.value = ''
  }
  function restore() {
    if (!pending) return
    try {
      restoreBackup(pending.raw)
      setPending(null)
      setError('')
      onUpdated()
    } catch (error) {
      setError(errorMessage(error))
    }
  }
  return (
    <section className="browser-storage" aria-label="Armazenamento e backup">
      <div>
        <strong>Seu ritmo. Seus dados.</strong>
        <p>
          Seus hábitos ficam neste navegador, sem conta ou sincronização. Exporte um backup antes de
          limpar os dados do site.
        </p>
      </div>
      <div className="backup-actions">
        <button className="button secondary" onClick={download} disabled={disabled}>
          <DownloadSimple size={17} />
          Exportar backup
        </button>
        <button
          className="button secondary"
          ref={importButton}
          onClick={() => input.current?.click()}
          disabled={disabled}
        >
          <UploadSimple size={17} />
          Importar backup
        </button>
        <input
          ref={input}
          className="visually-hidden"
          tabIndex={-1}
          type="file"
          accept=".json,application/json"
          aria-label="Arquivo de backup"
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <Dialog.Root
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              importButton.current?.focus()
            }}
          >
            <Dialog.Close className="icon-button dialog-close" aria-label="Fechar">
              <X size={21} />
            </Dialog.Close>
            <Dialog.Title>Restaurar seu backup?</Dialog.Title>
            <Dialog.Description>
              O arquivo contém {pending?.count} hábitos. A importação substitui os hábitos e
              marcações deste navegador. Exporte os dados atuais antes de continuar.
            </Dialog.Description>
            <div className="delete-actions">
              <button className="button secondary" onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button className="button primary" onClick={restore}>
                Restaurar backup
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
