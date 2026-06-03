export class VoiceTurnCoordinator {
  private currentTurnId: number = 0;

  startTurn(): number {
    this.currentTurnId += 1;
    return this.currentTurnId;
  }

  isCurrent(turnId: number): boolean {
    return this.currentTurnId === turnId;
  }

  getCurrentTurnId(): number {
    return this.currentTurnId;
  }
}

export const voiceTurnCoordinator = new VoiceTurnCoordinator();
