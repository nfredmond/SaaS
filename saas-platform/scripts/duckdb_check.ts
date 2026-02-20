import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");

const run = (sql: string) =>
  new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function main() {
  const version = await run("select version() as version");
  console.log(version);
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
