import mustache from "https://cdn.skypack.dev/mustache?dts";
import { serveDir } from "https://deno.land/std@0.166.0/http/file_server.ts";

const teams = {
  "G2 Esports": {
    short: "G2",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FG2-FullonDark.png",
  },
  "Team Vitality": {
    short: "VIT",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FVitality-logo-color-outline-rgb.png",
  },
  "SK Gaming": {
    short: "SK",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1643979272144_SK_Monochrome.png",
  },
  "Team Heretics": {
    short: "HRT",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1672933861879_Heretics-Full-Color.png",
  },
  Fnatic: {
    short: "FNC",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1631819669150_fnc-2021-worlds.png",
  },
  "Excel Esports": {
    short: "XL",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FExcel_FullColor2.png",
  },
  KOI: {
    short: "KOI",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1672933825498_KOI_29logo_square.webp",
  },
  "MAD Lions": {
    short: "MAD",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1631819614211_mad-2021-worlds.png",
  },
  Astralis: {
    short: "AST",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FAST-FullonDark.png",
  },
  "Team BDS": {
    short: "BDS",
    logo: "https://am-a.akamaihd.net/image?resize=70:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1641292031788_Team_BDSlogo_square.png",
  },
};
const aliases: Record<string, string> = {
  "FC Schalke 04 Esports": "Team BDS",
  Splyce: "MAD Lions",
  Origen: "Astralis",
  "Misfits Gaming": "Team Heretics",
  "Rogue (European Team)": "KOI",
};

type ApiGame = {
  blue: string;
  red: string;
  blueW: "0" | "1";
  redW: "0" | "1";
  length: string;
};

function collectData(offset: number): Promise<AdjustedGame[]> {
  return fetch(
    `https://lol.gamepedia.com/api.php?${new URLSearchParams({
      action: "cargoquery",
      tables: "Tournaments=T, MatchSchedule=MS, ScoreboardGames = SB",
      fields:
        "MS.Team1=blue, MS.Team2=red, MS.Team1Score=blueW, MS.Team2Score=redW, SB.Gamelength_Number=length",
      format: "json",
      limit: "45",
      where:
        'T.League= "LoL EMEA Championship" AND T.IsPlayoffs = "0" AND MS.IsTiebreaker = "0" AND T.Date IS NOT NULL',
      join_on: "T.OverviewPage=MS.OverviewPage, MS.MatchId = SB.MatchId",
      order_by: "MS.DateTime_UTC",
      offset: (offset * 45).toString(),
    }).toString()}`,
  ).then(async (res) => {
    if (res.ok) {
      const json: { cargoquery: { title: ApiGame }[] } = await res.json();
      return json.cargoquery.map((t) => ({
        red: getAlias(t.title.red),
        blue: getAlias(t.title.blue),
        redW: t.title.redW === "1",
        blueW: t.title.blueW === "1",
        length: Number.parseFloat(t.title.length),
      }));
    }
    throw new Error(await res.text());
  });
}

type AdjustedGame = {
  blue: string;
  red: string;
  blueW: boolean;
  redW: boolean;
  length: number;
};

type Game = {
  against: string;
  win: boolean;
  length: number;
};

class Team {
  #name: string;
  #short: string;
  #logo: string;
  #games: Game[] = [];
  #placement = 0;

  constructor(name: string, short: string, logo: string) {
    this.#name = name;
    this.#short = short;
    this.#logo = logo;
  }

  get name() {
    return this.#name;
  }

  get short() {
    return this.#short;
  }

  get logo() {
    return this.#logo;
  }

  push(game: AdjustedGame) {
    this.#games.push({
      against: game.blue === this.#name ? game.red : game.blue,
      win: game.blue === this.#name ? game.blueW : game.redW,
      length: game.length,
    });
  }

  get wins(): number {
    return this.#games.filter((g) => g.win).length;
  }

  get losses(): number {
    return 9 - this.wins;
  }

  get last4Wins(): number {
    return this.last4.filter(Boolean).length;
  }

  get last4(): boolean[] {
    return this.#games.slice(5).map((g) => g.win);
  }

  get victoryTime(): number {
    return this.#games.filter((g) => g.win).reduce((p, c) => p + c.length, 0);
  }

  get placement() {
    return this.#placement;
  }

  set placement(place: number) {
    this.#placement = place;
  }

  tiebreaker(against: Team[]): number {
    return this.#games.filter(
      (g) => g.win && against.map((t) => t.name).includes(g.against),
    ).length;
  }

  strengthOfVictory(allTeams: Team[][]) {
    return this.#games
      .filter((g) => g.win)
      .reduce(
        (p, c) =>
          p + allTeams.flat().find((t) => t.name === c.against)!.placement,
        0,
      );
  }

  static compare(a: Team, b: Team): number {
    if (a.wins !== b.wins) return a.wins - b.wins;
    if (a.last4Wins !== b.last4Wins) return a.last4Wins - b.last4Wins;
    return 0;
  }

  static head2head(teams: Team[], allTeams: Team[][]): Team[] {
    if (teams.length === 2) {
      if (teams[0].#games.find((g) => g.against === teams[1].name)!.win) {
        return teams;
      }
      return [teams[1], teams[0]];
    }
    return teams.sort((a, b) => {
      const tiebreaker = b.tiebreaker(teams) - a.tiebreaker(teams);
      if (tiebreaker === 0)
        return b.strengthOfVictory(allTeams) - a.strengthOfVictory(allTeams);
      return tiebreaker;
    });
  }
}

const getAlias = (name: string) => {
  return aliases[name] ?? name;
};

// calculate sorted standings
function calculateStandings(
  name: {
    year: number;
    split: string;
    half: number;
    name: string;
  },
  games: AdjustedGame[],
) {
  const teamsArray = Object.entries(teams).map(
    ([name, { short, logo }]) => new Team(name, short, logo),
  );
  for (const game of games) {
    teamsArray.find((team) => team.name === getAlias(game.blue))!.push(game);
    teamsArray.find((team) => team.name === getAlias(game.red))!.push(game);
  }
  const grouped = teamsArray
    .sort(Team.compare)
    .slice(1)
    .reduce(
      (p, c) => {
        if (Team.compare(p[0][0], c) === 0) {
          p[0].push(c);
        } else {
          p.unshift([c]);
        }
        c.placement = 11 - p.length;
        return p;
      },
      [[teamsArray[0]]] as Team[][],
    );
  return {
    ...name,
    table: grouped
      .flatMap((teams, _, allTeams) =>
        teams.length === 1 ? teams : Team.head2head(teams, allTeams),
      )
      .map((team, position, standings) => {
        const tied =
          position >= 8
            ? standings[7].wins === team.wins
            : team.wins === standings[8].wins;
        return {
          team,
          position: position + 1,
          result: tied ? "tied" : position < 8 ? "safe" : "out",
        };
      }),
  };
}

// build all names
const entries: { year: number; split: string; half: number; name: string }[] =
  [];
for (let year = 2019; year <= 2022; year++) {
  for (const split of ["Spring", "Summer"]) {
    for (const half of [1, 2]) {
      const name = `${year}/${split}/${half}`;
      entries.push({ year, split, half, name });
    }
  }
}

const standings = await Promise.all(
  entries.map((name, i) =>
    collectData(i).then(calculateStandings.bind(undefined, name)),
  ),
);

const round = (n: number, percent = false) =>
  n === 0 ? 0 : (Math.round(n * 100) / 100) * (percent ? 100 : 1);

async function build() {
  const [split, team, footer, main] = await Promise.all(
    ["split", "team", "footer", "main"].map((path) =>
      Deno.readTextFile(`./templates/${path}.mustache`),
    ),
  );
  await Promise.all(
    standings.map((s, i) => {
      return Deno.mkdir(`dist/splits/${s.name}`, { recursive: true }).then(() =>
        Deno.writeTextFile(
          `dist/splits/${s.name}/index.html`,
          mustache.render(
            split,
            {
              ...s,
              umamiKey: Deno.env.get("UMAMI_KEY") ?? "",
              umamiUrl: Deno.env.get("UMAMI_URL") ?? "",
              prev: i === 0 ? null : standings.at(i - 1),
              next: standings.at(i + 1),
            },
            {
              footer,
            },
          ),
        ),
      );
    }),
  );

  await Promise.all(
    Object.entries(teams).map(([name, { short }]) =>
      Deno.mkdir(`dist/teams/${short}`, { recursive: true }).then(() => {
        const splits = standings.map(({ table, name: path, ...rest }) => ({
          ...rest,
          path,
          team: table.find((t) => t.team.name === name)!,
        }));
        const percentage = (kind: string) =>
          round(
            splits.filter((s) => s.team.result === kind).length /
              standings.length,
            true,
          );
        return Deno.writeTextFile(
          `dist/teams/${short}/index.html`,
          mustache.render(
            team,
            {
              umamiKey: Deno.env.get("UMAMI_KEY") ?? "",
              umamiUrl: Deno.env.get("UMAMI_URL") ?? "",
              name,
              splits,
              stats: [
                {
                  name: "safe",
                  helptext:
                    "Safe means this team would have made it to the round of the top 8 simply by having a sufficient record",
                },
                {
                  name: "tied",
                  helptext: `Tied means this team could have made it to the round of the top 8 as its record was good enough to force a tiebreaker.
            Seeding with tiebreakers is done in multiple steps.
            <ol><li>Better record in the last 4 games</li><li>Better head-to-head of all involved teams</li><li>Shortest victory time in sum during the season</li></ol>`,
                },
                {
                  name: "out",
                  helptext:
                    "Out means this team would not have made it to the round of the top 8 simply by not having a sufficient record",
                },
              ].map(({ name, helptext }) => ({
                name,
                helptext,
                percentage: percentage(name),
              })),
            },
            { footer },
          ),
        );
      }),
    ),
  );

  await Deno.writeTextFile(
    `dist/index.html`,
    mustache.render(
      main,
      {
        umamiKey: Deno.env.get("UMAMI_KEY") ?? "",
        umamiUrl: Deno.env.get("UMAMI_URL") ?? "",
        teams: Object.entries(teams).map(([name, info]) => ({ name, info })),
        splits: entries,
      },
      { footer },
    ),
  );
}

await build();

if (Deno.args[0] === "serve") {
  Deno.serve((req) => serveDir(req, { fsRoot: "dist" }));
} else {
  await Deno.writeTextFile("dist/riot.txt", Deno.env.get("RIOT_KEY") ?? "");
}
