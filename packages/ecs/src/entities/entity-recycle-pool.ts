export class EntityRecyclePool {
  private readonly freeList: number[];
  private freeCount = 0;

  constructor(capacity = 1024) {
    this.freeList = new Array<number>(capacity);
    for (let entity = capacity - 1; entity >= 0; entity -= 1) {
      this.freeList[this.freeCount] = entity;
      this.freeCount += 1;
    }
  }

  acquire(): number {
    if (this.freeCount === 0) return -1;
    this.freeCount -= 1;
    return this.freeList[this.freeCount];
  }

  release(entity: number): void {
    if (entity < 0 || this.freeCount >= this.freeList.length) return;
    this.freeList[this.freeCount] = entity;
    this.freeCount += 1;
  }

  count(): number {
    return this.freeCount;
  }

  reset(): void {
    this.freeCount = 0;
    for (let entity = this.freeList.length - 1; entity >= 0; entity -= 1) {
      this.freeList[this.freeCount] = entity;
      this.freeCount += 1;
    }
  }
}
