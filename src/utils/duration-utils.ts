export const formatDaysToReadable = (days: number): string => {
  if (days === 0) return "0 hours"
  
  const fullDays = Math.floor(days)
  const remainingHours = Math.round((days - fullDays) * 8)
  
  // Casos especiales
  if (fullDays === 0) {
    return remainingHours === 1 ? "1 hour" : `${remainingHours} hours`
  }
  
  if (remainingHours === 0) {
    return fullDays === 1 ? "1 day" : `${fullDays} days`
  }
  
  const dayText = fullDays === 1 ? "day" : "days"
  const hourText = remainingHours === 1 ? "hour" : "hours"
  
  return `${fullDays} ${dayText} ${remainingHours} ${hourText}`
}

export const formatDaysToCompact = (days: number): string => {
  if (days === 0) return "0h"
  
  const fullDays = Math.floor(days)
  const remainingHours = Math.round((days - fullDays) * 8)
  
  if (fullDays === 0) {
    return `${remainingHours}h`
  }
  
  if (remainingHours === 0) {
    return `${fullDays}d`
  }
  
  return `${fullDays}d ${remainingHours}h`
}