import { CreateTaskForm } from './tasks/components/CreateTaskForm'

export default function Home() {
  return (
    <div className='bg-background w-[28rem] p-10 h-dvh overflow-y-auto relative border-l border-l-white/10'>
      <CreateTaskForm />
    </div>
  )
}