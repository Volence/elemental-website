import fs from 'fs'
import path from 'path'

let _cached: string | null = null

const ADMIN_RULES = `
rule("ELMT Admin: Pause or Unpause")
{
\tevent
\t{
\t\tOngoing - Global;
\t}

\tconditions
\t{
\t\tIs Button Held(Host Player, Button(Interact)) == True;
\t\tTeam Of(Host Player) == All Teams;
\t}

\tactions
\t{
\t\tIf(Global.ELMT_IsPaused == False);
\t\t\tSet Slow Motion(0);
\t\t\tPause Match Time;
\t\t\tGlobal.ELMT_IsPaused = True;
\t\t\tBig Message(All Players(All Teams), Custom String("MATCH PAUSED"));
\t\tElse;
\t\t\tSet Slow Motion(100);
\t\t\tUnpause Match Time;
\t\t\tGlobal.ELMT_IsPaused = False;
\t\t\tBig Message(All Players(All Teams), Custom String("MATCH RESUMED"));
\t\tEnd;
\t\tWait(1, Ignore Condition);
\t}
}

rule("ELMT Admin: End Game Draw")
{
\tevent
\t{
\t\tOngoing - Global;
\t}

\tconditions
\t{
\t\tIs Button Held(Host Player, Button(Ultimate)) == True;
\t\tTeam Of(Host Player) == All Teams;
\t}

\tactions
\t{
\t\tBig Message(All Players(All Teams), Custom String("MATCH ENDING - DRAW"));
\t\tWait(3, Ignore Condition);
\t\tDeclare Match Draw;
\t}
}

rule("ELMT Admin: Team 1 Wins")
{
\tevent
\t{
\t\tOngoing - Global;
\t}

\tconditions
\t{
\t\tIs Button Held(Host Player, Button(Ability 1)) == True;
\t\tTeam Of(Host Player) == All Teams;
\t}

\tactions
\t{
\t\tBig Message(All Players(All Teams), Custom String("TEAM 1 WINS"));
\t\tSet Team Score(Team 1, Max(Team Score(Team 1), Add(Team Score(Team 2), 1)));
\t\tWait(3, Ignore Condition);
\t\tDeclare Team Victory(Team 1);
\t}
}

rule("ELMT Admin: Team 2 Wins")
{
\tevent
\t{
\t\tOngoing - Global;
\t}

\tconditions
\t{
\t\tIs Button Held(Host Player, Button(Ability 2)) == True;
\t\tTeam Of(Host Player) == All Teams;
\t}

\tactions
\t{
\t\tBig Message(All Players(All Teams), Custom String("TEAM 2 WINS"));
\t\tSet Team Score(Team 2, Max(Team Score(Team 2), Add(Team Score(Team 1), 1)));
\t\tWait(3, Ignore Condition);
\t\tDeclare Team Victory(Team 2);
\t}
}

rule("ELMT Admin: Unpause on Game End")
{
\tevent
\t{
\t\tOngoing - Global;
\t}

\tconditions
\t{
\t\tIs Match Complete == True;
\t}

\tactions
\t{
\t\tIf(Global.ELMT_IsPaused == True);
\t\t\tSet Slow Motion(100);
\t\t\tUnpause Match Time;
\t\t\tGlobal.ELMT_IsPaused = False;
\t\tEnd;
\t}
}

`

export function getWorkshopTemplate(): string {
  if (_cached) return _cached

  const sourcePath = path.join(process.cwd(), 'docs/elemental-scrimtime.txt')
  const source = fs.readFileSync(sourcePath, 'utf-8')
  const lines = source.split('\n')

  // Find the end of the settings block (closing brace at indent level 0)
  let settingsEnd = 0
  let braceDepth = 0
  let inSettings = false
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    if (i === 0 && trimmed === 'settings') {
      inSettings = true
      continue
    }
    if (inSettings) {
      if (trimmed.startsWith('{')) braceDepth++
      if (trimmed.startsWith('}')) {
        braceDepth--
        if (braceDepth === 0) {
          settingsEnd = i + 1
          break
        }
      }
    }
  }

  const afterSettings = lines.slice(settingsEnd).join('\n').trim()

  // Inject admin variable into the global variables block
  // Position tracking vars (70-72) were removed; ELMT_IsPaused goes at slot 70
  const withAdminVar = afterSettings.replace(
    '\t\t69: Logs_PlayerSummaryCount',
    '\t\t69: Logs_PlayerSummaryCount\n\t\t70: ELMT_IsPaused',
  )

  _cached = withAdminVar + '\n' + ADMIN_RULES
  return _cached
}
