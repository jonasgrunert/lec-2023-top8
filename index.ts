import mustache from "https://cdn.skypack.dev/mustache?dts";
import { serveDir } from "https://deno.land/std@0.166.0/http/file_server.ts";
import { _format } from "https://deno.land/std@0.166.0/path/_util.ts";
import { serve } from "https://deno.land/std@0.166.0/http/server.ts";

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
    short: "TH",
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
  "KOI (Spanish Team)": "KOI",
};

type ApiGame = {
  blue: string;
  red: string;
  blueW: "0" | "1" | null;
  redW: "0" | "1" | null;
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
        red: getAlias(t.title.red) as keyof typeof teams,
        blue: getAlias(t.title.blue) as keyof typeof teams,
        redW: t.title.redW !== null ? t.title.redW === "1" : null,
        blueW: t.title.redW !== null ? t.title.blueW === "1" : null,
        length: Number.parseFloat(t.title.length),
      }));
    }
    throw new Error(await res.text());
  });
}

type AdjustedGame = {
  blue: keyof typeof teams;
  red: keyof typeof teams;
  blueW: boolean | null;
  redW: boolean | null;
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
  placement = 0;
  #SoV = -1;
  probability?: [number, number];

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
    if (game.blueW !== null)
      this.#games.push({
        against: game.blue === this.#name ? game.red : game.blue,
        win: game.blue === this.#name ? game.blueW! : game.redW!,
        length: game.length,
      });
  }

  get wins(): number {
    return this.#games.filter((g) => g.win).length;
  }

  get losses(): number {
    return this.#games.length - this.wins;
  }

  get last4Wins(): number {
    return this.last4.filter(Boolean).length;
  }

  get last4(): boolean[] {
    return this.#games.slice(this.#games.length - 4).map((g) => g.win);
  }

  get victoryTime(): number {
    return this.#games.filter((g) => g.win).reduce((p, c) => p + c.length, 0);
  }

  get SoV() {
    return this.#SoV;
  }

  get probTied() {
    if (this.probability) {
      return round(this.probability[0], true);
    }
    if (this.wins > 2) return 100;
    const remains = 9 - this.#games.length;
    let result = 0;
    for (let i = 3 - this.wins; i <= remains; i++) {
      result += nCr(remains, i);
    }
    return round(result / Math.pow(2, remains), true);
  }

  get probIn() {
    if (this.probability) {
      return round(this.probability[1], true);
    }
    if (this.wins > 4) return 100;
    const remains = 9 - this.#games.length;
    let result = 0;
    for (let i = 5 - this.wins; i <= remains; i++) {
      result += nCr(remains, i);
    }
    return round(result / Math.pow(2, remains), true);
  }

  toJSON() {
    return {
      short: this.#short,
      name: this.#name,
      logo: this.#logo,
      wins: this.wins,
      losses: this.losses,
    };
  }

  tiebreaker(against: Team[]): number {
    return this.#games.filter(
      (g) => g.win && against.map((t) => t.name).includes(g.against),
    ).length;
  }

  strengthOfVictory(allTeams: Array<Team | Team[]>) {
    this.#SoV = this.#games
      .filter((g) => g.win)
      .reduce(
        (p: number, c) =>
          p +
          (allTeams.flat().find((t) => t.name === c.against)?.placement ?? 0),
        0,
      );
    return this;
  }

  compare(other: Team): number {
    const wins = this.wins - other.wins;
    return wins ? wins : other.losses - this.losses;
  }

  static break(teams: Team[]): Array<Team | Team[]> {
    const tied = teams.sort((a, b) => b.SoV - a.SoV);
    const result: Array<Team | Team[]> = [];
    for (let i = 0; i < tied.length; i++) {
      const sameScore = tied
        .slice(i + 1)
        .findLastIndex((t) => t.SoV === tied[i].SoV);
      if (sameScore === -1) {
        result.push(tied[i]);
      } else {
        result.push(
          tied
            .slice(i, i + sameScore + 2)
            .sort((a, b) => b.victoryTime - a.victoryTime),
        );
        i += sameScore + 1;
      }
    }
    return result;
  }

  static head2head(teams: Team[]): Array<Team | Team[]> {
    if (teams.length === 2) {
      if (teams[0].#games.find((g) => g.against === teams[1].name)?.win) {
        return teams;
      }
      return [teams[1], teams[0]];
    }
    const tied = teams.sort(
      (a, b) => b.tiebreaker(teams) - a.tiebreaker(teams),
    );
    const result: Array<Team | Team[]> = [];
    for (let i = 0; i < tied.length; i++) {
      const tie = tied[i].tiebreaker(teams);
      const sameScore = tied
        .slice(i + 1)
        .findLastIndex((t) => t.tiebreaker(teams) === tie);
      if (sameScore === -1) {
        result.push(tied[i]);
      } else {
        const newTie = tied.slice(i, i + sameScore + 2);
        if (newTie.length === tied.length) {
          result.push(...Team.break(tied));
        } else {
          result.push(...Team.head2head(newTie));
        }
        i += sameScore + 1;
      }
    }
    return result;
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
  const result: Array<Team | Team[]> = [];
  const sorted = teamsArray.sort((a, b) => b.compare(a));
  for (let i = 0; i < sorted.length; i++) {
    const sameScore = sorted
      .slice(i + 1)
      .findLastIndex((t) => t.compare(sorted[i]) === 0);
    if (sameScore === -1) {
      sorted[i].placement = 10 - i;
      result.push(sorted[i]);
    } else {
      const newTie = sorted.slice(i, i + sameScore + 2);
      if ((i <= 7 && i + newTie.length >= 7) || newTie.length !== 2) {
        result.push(
          newTie.map((t) => {
            t.placement = 10 - i;
            return t;
          }),
        );
      } else {
        result.push(
          ...newTie
            .sort((a, b) => (b.tiebreaker([a]) === 1 ? 1 : -1))
            .map((t, x) => {
              t.placement = 10 - x - i;
              return t;
            }),
        );
      }
      i += sameScore + 1;
    }
  }
  const grouped = result
    .map((t) =>
      t instanceof Team
        ? t.strengthOfVictory(result)
        : t.map((team) => team.strengthOfVictory(result)),
    )
    .flatMap((teams) => {
      if (teams instanceof Team) {
        return [teams];
      }
      if (
        teams[0].placement >= 3 &&
        teams[0].placement - teams.length + 1 < 3
      ) {
        if (teams.length > 3) {
          const sorted = Team.head2head(teams);
          let pos = teams[0].placement;
          const all = [];
          let i = -1;
          while (pos > 3) {
            i++;
            const team = sorted[i];
            if (team instanceof Team) {
              if (pos > 3) {
                all.push(team);
              }
              pos--;
            } else {
              if (pos - team.length > 3) {
                all.push(team);
              }
              pos -= team.length;
            }
          }
          all.push(sorted.slice(i).flat());
          return all;
        }
        return [teams];
      }
      return Team.head2head(teams);
    });
  const table: {
    team: Team;
    result: string;
    position: number;
  }[] = [];
  let position = 1;
  for (const teams of grouped) {
    if (teams instanceof Team) {
      table.push({
        team: teams,
        position,
        result: position < 9 ? "safe" : "out",
      });
      position++;
    } else {
      table.push(
        ...teams.map((team) => ({
          team,
          position,
          result:
            position <= 9
              ? position + teams.length > 9
                ? "tied"
                : "safe"
              : "out",
        })),
      );
      position += teams.length;
    }
  }
  return {
    ...name,
    table,
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

const round = (n: number, percent = false) => {
  if (n === 0) return 0;
  const m = String((Math.round(n * 10000) / 10000) * (percent ? 100 : 1));
  return m.slice(0, m.search(/\./) === -1 ? m.length : m.search(/\./) + 3);
};

function nCr(n: number, r: number) {
  const k = 2 + r > n ? n - r : r;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n + 1 - i)) / i;
  }
  return result;
}

async function build() {
  await buildFoldySheet();
  const [split, team, footer] = await Promise.all(
    ["split", "team", "footer"].map((path) =>
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
            <ol>
            <li>Best Head to Head score of all teams</li>
            <li>Highest Strength of Victory. The strength of victory is determined by a point system wherer a win against higher ranked teams brings more points.</li>
            <li>Lowest victory time during the regular season. This places the teams in a bracket for tiebreaker games, which cannot be predicted.</li>
            </ol>`,
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
}

type FoldySheet = Record<
  string,
  ReturnType<typeof calculateStandings>["table"]
>;

async function buildFoldySheet() {
  const data = await collectData(entries.length);
  const standings: FoldySheet = {};
  for (let i = 0; i < 1 << 15; i++) {
    for (let j = 0; j < 15; j++) {
      const v = Boolean(i & (1 << j));
      data.at(-j - 1)!.blueW = v;
      data.at(-j - 1)!.redW = !v;
    }
    const res = calculateStandings(
      {
        year: 2023,
        split: "Winter",
        half: 1,
        name: "Current",
      },
      data,
    ).table;
    standings[i.toString(2).padStart(15, "0")] = res;
  }
  await Deno.mkdir("./dist/data", { recursive: true });
  await Deno.writeTextFile("./dist/data/foldy.json", JSON.stringify(standings));
}

async function serveIndex() {
  const data = await collectData(entries.length);
  const { scenarios } = await getScenarios();
  const tiedProbability = Object.fromEntries(
    Object.values(teams).map((t) => [t.short, 0]),
  );
  const outProbability = Object.fromEntries(
    Object.values(teams).map((t) => [t.short, 0]),
  );
  for (const scenario of scenarios) {
    for (const team of scenario.out) {
      outProbability[team]++;
    }
    for (const team of scenario.tied) {
      tiedProbability[team]++;
    }
  }
  const table = calculateStandings(
    { year: 2023, split: "Winter", half: 1, name: "Current" },
    data.filter((f) => f.blueW !== null),
  ).table;
  const amount = scenarios.length;
  table.forEach((t) => {
    t.team.probability = [
      (amount - outProbability[t.team.short]) / amount,
      (amount - outProbability[t.team.short] - tiedProbability[t.team.short]) /
        amount,
    ];
  });
  const [footer, main] = await Promise.all(
    ["footer", "main"].map((path) =>
      Deno.readTextFile(`./templates/${path}.mustache`),
    ),
  );
  return new Response(
    mustache.render(
      main,
      {
        umamiKey: Deno.env.get("UMAMI_KEY") ?? "",
        umamiUrl: Deno.env.get("UMAMI_URL") ?? "",
        splits: entries,
        table,
      },
      { footer },
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": `max-age=${5 * 60}`,
      },
    },
  );
}

async function getScenarios() {
  const [games, scenarios] = await Promise.all([
    collectData(entries.length),
    Deno.readTextFile(`./dist/data/foldy.json`).then(
      (t) => JSON.parse(t) as FoldySheet,
    ),
  ]);
  const remainingGames = games.filter((g) => g.blueW === null);
  const decided = games
    .slice(30, remainingGames.length === 0 ? undefined : -remainingGames.length)
    .map((g) => (g.blueW ? 1 : 0))
    .join("");
  const arr = [];
  for (const [key, table] of Object.entries(scenarios)) {
    if (key.startsWith(decided)) {
      const results = key
        .slice(decided.length)
        .split("")
        .map((g, i) =>
          g === "1"
            ? teams[remainingGames[i].blue]
            : teams[remainingGames[i].red],
        );
      const out = table
        .filter((t) => t.result === "out")
        .map((t) => t.team.short);
      const tied = table
        .filter((t) => t.result === "tied")
        .map((t) => t.team.short);
      arr.push({
        key,
        results,
        table,
        out,
        tied,
        colspan: results.length + 2,
      });
    }
  }
  return {
    remainingGames: remainingGames.map((g, i) => ({
      id: i,
      red: teams[g.red],
      blue: teams[g.blue],
    })),
    scenarios: arr,
  };
}

async function serveFoldySheet() {
  const { remainingGames, scenarios } = await getScenarios();
  const [footer, foldy] = await Promise.all(
    ["footer", "foldy"].map((path) =>
      Deno.readTextFile(`./templates/${path}.mustache`),
    ),
  );
  return new Response(
    mustache.render(
      foldy,
      {
        umamiKey: Deno.env.get("UMAMI_KEY") ?? "",
        umamiUrl: Deno.env.get("UMAMI_URL") ?? "",
        scenarios,
        remainingGames,
      },
      { footer },
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": `max-age=${30 * 60}`,
      },
    },
  );
}

const serveContent = () =>
  serve((req) => {
    const path = new URL(req.url).pathname;
    switch (path) {
      case "/":
        return serveIndex();
      case "/foldy":
        return serveFoldySheet();
      case "riot.txt":
        return new Response(Deno.env.get("RIOT_KEY") ?? "");
      default:
        return serveDir(req, { fsRoot: "dist" });
    }
  });

switch (Deno.args?.[0]) {
  case "build": {
    await build();
    break;
  }
  case "dev": {
    await build();
    await serveContent();
    break;
  }
  default: {
    await serveContent();
  }
}
