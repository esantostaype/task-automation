import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { CreateTaskForm, Header } from '@/components'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "Inszone Task Automation",
  description: "Inszone Task Automation is a smart task automation platform that optimizes creative workflows, assigns tasks by priority and skill, and calculates deadlines based on real working hours."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ inter.className }>
      <body>
        <Providers>
          <main className='flex'>
            <section className='flex-1'>
              <Header/>
              <section className='p-6'>
                { children }
              </section>
            </section>
            <CreateTaskForm/>
          </main>
        </Providers>
      </body>
    </html>
  )
}