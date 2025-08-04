import { CreateTaskForm, GlobalModal, Header, ProtectedRoute } from '@/components'
import { GlobalConfirmation } from '@/components/Confirmation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <main className='flex'>
        <section className='flex-1 h-dvh overflow-y-auto flex flex-col'>
          <Header />
          {children}
        </section>
        <CreateTaskForm />
      </main>
      <GlobalModal />
      <GlobalConfirmation />
    </ProtectedRoute>
  )
}