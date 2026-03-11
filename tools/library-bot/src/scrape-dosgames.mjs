import path from "node:path";
import * as cheerio from "cheerio";
import slugify from "slugify";
import { fetchHtml, isLegalLicense, normalizeLicense, wait, writeJson } from "./utils.mjs";

const LIST_PAGES = [
  { license: "Freeware", url: "https://www.dosgamesarchive.com/licenses/freeware/" },
  { license: "Shareware", url: "https://www.dosgamesarchive.com/licenses/shareware/" }
];

function parseYear(value = "") {
  const year = Number(String(value).match(/\d{4}/)?.[0]);
  return Number.isFinite(year) ? year : null;
}

function pickGenre(text = "") {
  return text.split(",").map(v => v.trim()).filter(Boolean)[0] || "Other";
}

export async function scrapeDosGamesArchive({ outputPath, throttleMs = 300 }) {
  const entries = [];

  for (const listPage of LIST_PAGES) {
    const html = await fetchHtml(listPage.url);
    const $ = cheerio.load(html);

    const gameLinks = new Map();
    $("a[href*='/game/']").each((_, anchor) => {
      const href = $(anchor).attr("href");
      const title = $(anchor).text().trim();
      if (!href || !title) return;
      const url = new URL(href, listPage.url).toString();
      gameLinks.set(url, title);
    });

    for (const [detailUrl, titleFromList] of gameLinks.entries()) {
      await wait(throttleMs);
      const detailHtml = await fetchHtml(detailUrl);
      const $$ = cheerio.load(detailHtml);

      const title = $$("h1").first().text().trim() || titleFromList;
      const textDump = $$("main").text();
      const year = parseYear(textDump);
      const genre = pickGenre($$("a[href*='/genres/']").first().text().trim() || "Other");
      const downloadHref = $$('a:contains("Download")').first().attr("href") || $$('a[href*="/download/"]').first().attr("href") || null;
      const sourceDownloadUrl = downloadHref ? new URL(downloadHref, detailUrl).toString() : "";
      const slug = slugify(title, { lower: true, strict: true }) || slugify(detailUrl.split("/").filter(Boolean).pop() || "game", { lower: true, strict: true });

      const entry = {
        id: slug,
        title,
        year,
        genre,
        category: genre.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other",
        license: listPage.license,
        source: "dosgamesarchive",
        sourceUrl: detailUrl,
        sourceDownloadUrl,
        tags: [normalizeLicense(listPage.license), "dos", "auto-discovered"],
        metadataOnly: !sourceDownloadUrl
      };

      if (isLegalLicense(entry.license)) {
        entries.push(entry);
      }
    }
  }

  const deduped = Object.values(Object.fromEntries(entries.map(entry => [entry.id, entry])));
  await writeJson(outputPath, deduped);
  return deduped;
}
