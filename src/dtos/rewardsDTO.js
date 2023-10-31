/**
 * Represents a Reward Data Transfer Object.
 */
export class RewardDTO {
  constructor(params) {
    this.eventId = params.eventId;
    this.userTelegramID = params.userTelegramID;
    this.responsePath = params.responsePath;
    this.userHandle = params.userHandle;
    this.userName = params.userName;
    this.patchwallet = params.patchwallet;
  }
}