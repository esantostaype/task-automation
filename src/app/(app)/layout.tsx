import { Providers } from '../providers'
import { CreateTaskForm, GlobalModal, Header } from '@/components'
import { GlobalConfirmation } from '@/components/Confirmation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className='flex'>
        <section className='flex-1 h-dvh overflow-y-auto flex flex-col'>
          <Header />
          {children}
        </section>
        <CreateTaskForm />
      </main>
      <GlobalModal />
      <GlobalConfirmation />
    </Providers>
  )
}