import { describe, it, expect } from 'vitest'
import { EventBus } from '../src/event-bus'

describe('EventBus', () => {
  it('delivers events to listeners', () => {
    const bus = new EventBus<{ ping: string }>()
    const received: string[] = []
    bus.on('ping', (p) => received.push(p))
    bus.emit('ping', 'hello')
    expect(received).toEqual(['hello'])
  })
})
