import { useState } from 'react'

export function useVideoTrim(initialDuration: number) {
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(initialDuration)

  return { startTime, endTime, setStartTime, setEndTime }
}
