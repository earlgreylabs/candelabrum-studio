export type FactoryBuilder<T> = () => T;

export class ProviderRegistry<T> {
  private readonly builders = new Map<string, FactoryBuilder<T>>();

  constructor(private readonly providerType: string) {}

  register(id: string, builder: FactoryBuilder<T>): void {
    if (this.builders.has(id)) {
      throw new Error(`Provider '${id}' is already registered for ${this.providerType}.`);
    }
    this.builders.set(id, builder);
  }

  resolve(id: string): T {
    const builder = this.builders.get(id);
    if (!builder) {
      throw new Error(`Unknown ${this.providerType} provider: ${id}`);
    }
    return builder();
  }
}
