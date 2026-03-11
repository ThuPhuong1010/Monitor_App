import MonthView from '../components/calendar/MonthView'

export default function Calendar() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-fg">Calendar</h1>
      <MonthView />
    </div>
  )
}
