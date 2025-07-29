import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { CreateTaskForm, GlobalModal, Header } from '@/components'
import { GlobalConfirmation } from '@/components/Confirmation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "Assignify by Inszone",
  description: "Assignify by Inszone is a smart task automation platform that optimizes creative workflows, assigns tasks by priority and skill, and calculates deadlines based on real working hours."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
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
      </body>
    </html>
  )
}