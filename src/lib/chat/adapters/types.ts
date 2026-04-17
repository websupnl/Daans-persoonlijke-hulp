/**
 * Channel Adapter Types
 */

export interface ChannelAdapter {
  formatResponse(response: any): any
  parseInput(input: any): any
  generateUI(actions: any[]): any
}
