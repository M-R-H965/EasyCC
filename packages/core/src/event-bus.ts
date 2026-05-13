type Handler<T = unknown> = (payload: T) => void

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler>>()
  private anyHandlers: Set<(event: string, payload: unknown) => void> = new Set()

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler as Handler)
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler)
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const wrapper: Handler<Events[K]> = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    this.on(event, wrapper)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(payload)
      } catch (err) {
        console.error(`EventBus handler error on "${String(event)}":`, err)
      }
    })

    this.anyHandlers.forEach((h) => {
      try {
        h(String(event), payload)
      } catch (err) {
        console.error('EventBus anyHandler error:', err)
      }
    })
  }

  onAny(handler: (event: string, payload: unknown) => void): void {
    this.anyHandlers.add(handler)
  }

  offAny(handler: (event: string, payload: unknown) => void): void {
    this.anyHandlers.delete(handler)
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event !== undefined) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
      this.anyHandlers.clear()
    }
  }
}
