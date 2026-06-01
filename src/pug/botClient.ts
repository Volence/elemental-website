const BOT_URL = () => process.env.OW_BOT_SERVICE_URL
const BOT_SECRET = () => process.env.OW_BOT_SECRET ?? ''

export function botConfigured(): boolean {
  return !!BOT_URL()
}

export async function botFetch(path: string, body?: any): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Secret': BOT_SECRET(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

export async function botGet(path: string): Promise<Response> {
  return fetch(`${BOT_URL()}${path}`, {
    method: 'GET',
    headers: { 'X-Bot-Secret': BOT_SECRET() },
  })
}

// Invite a single person into the OW custom-game lobby as a spectator.
// team: 0 = Spectator (1 = Team 1, 2 = Team 2), per the bot's invite_players command.
export async function inviteSpectator(botInstanceId: string, battleTag: string): Promise<Response> {
  return botFetch(`/instance/${botInstanceId}/step`, {
    command: 'invite_players',
    players: [{ userId: 0, battleTag, team: 0 }],
  })
}
