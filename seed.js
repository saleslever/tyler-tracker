// Seed the last 21 days with realistic partial completion so charts have data.
const base = new Date();
const days = 21;

async function seed() {
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const date = `${y}-${m}-${dd}`;

    // 60-90% habit hit rate, weekend dip
    const hitRate = d.getDay() === 0 || d.getDay() === 6 ? 0.5 : 0.8;
    const rand = (p) => Math.random() < p ? 1 : 0;

    const patch = {
      fastingHours: 14 + Math.round(Math.random() * 6),
      weight: 215 - i * 0.2 + (Math.random() - 0.5),
      sleepScore: Math.round(78 + Math.random() * 18),
      steps: Math.round(6000 + Math.random() * 9000),
      water: rand(hitRate),
      vitamins: rand(hitRate),
      morningDrink: rand(hitRate),
      noAlcohol: rand(0.85),
      noEnergyDrinks: rand(0.7),
      workout: d.getDay() % 2 === 0 ? rand(0.85) : rand(0.3),
    };

    const res = await fetch(`http://localhost:5000/api/logs/${date}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) console.error(date, await res.text());
  }

  // A few sample tasks
  const tasks = [
    { title: "Review Sales Lever litigation prep with counsel", priority: "high", list: "today" },
    { title: "Ship Calloway's Compass CGM alert v2", priority: "high", list: "today" },
    { title: "Payroll approval for the 15th", priority: "med", list: "today" },
    { title: "Reply to Tatenda re: Raffiti build-out", priority: "med", list: "today" },
    { title: "Draft Wealth Outside Wallstreet newsletter", priority: "low", list: "backlog" },
    { title: "Q3 forecast update", priority: "med", list: "backlog" },
  ];
  for (const t of tasks) {
    await fetch("http://localhost:5000/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
  }

  console.log("Seed complete.");
}

seed();
