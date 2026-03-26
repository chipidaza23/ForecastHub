# Why I Built ForecastHub

## The Problem I Lived

For several years I worked in IT operations at a 25-location coffee chain. My team kept the systems running — point of sale, loyalty cards, back-office reporting — but I sat close enough to the operations team to watch their weekly inventory ritual up close.

Every Monday morning, the ops coordinator would pull a sales report from the POS, paste it into a master spreadsheet, manually update a column for each location, eyeball a few trend lines, and then decide how much to order. Coffee beans, milk, cups, syrups, pastries — dozens of SKUs across 25 stores. The spreadsheet used `=AVERAGE()` on the last 30 days. No seasonality. No confidence intervals. No safety stock math. No systematic reorder logic. Just gut feel dressed up as a process.

When the estimates were wrong — and they were wrong regularly — the consequences were immediate and painful. Locations would run out of oat milk on a Tuesday morning, scramble to borrow inventory from a nearby store, and lose revenue during peak hours. Or the opposite: over-order a seasonal pastry, watch it expire, and absorb the write-down. Either way, margin bled out, and the operations team spent half their time firefighting problems that better forecasting would have prevented.

The maddening part was that I knew the tools to fix this existed. I had read about StatsForecast, Prophet, and Darts. I had run forecasting notebooks in my own time. The math was solved. The libraries were free and genuinely excellent. But they lived in Jupyter notebooks, not dashboards. They required Python and a willingness to read documentation. They produced DataFrames, not decisions.

## The Gap in the Market

Demand forecasting software falls into two camps, and the space between them is enormous.

**Enterprise tools** — SAP Integrated Business Planning, Blue Yonder, Anaplan, o9 Solutions — are purpose-built for complex supply chains. They handle multi-echelon inventory, global supplier networks, S&OP workflows. They are also priced for Fortune 500 procurement budgets: $100,000 to $500,000 per year before implementation consulting. A 25-location coffee chain doesn't belong in that conversation.

**Spreadsheets and simple tools** — Excel, Google Sheets, maybe a basic inventory plugin for Shopify — are accessible but analytically shallow. `=AVERAGE(last_30_days)` ignores weekly and annual seasonality. It gives you no confidence interval, no safety stock recommendation, no reorder point. It tells you what happened, not what's coming.

The open-source forecasting ecosystem has genuinely closed the analytical gap. StatsForecast's AutoARIMA rivals commercial implementations. Ensemble methods with seasonal decomposition are now a few lines of Python. LLMs like Claude can reason over structured inventory data and answer plain-English questions with surprising accuracy. The technology is there.

What's missing is the bridge: a web interface that makes these tools usable by the operations manager who doesn't write Python, runs on infrastructure any team can afford (including free), and is honest about what it is — a serious analytical tool, not a toy.

## What ForecastHub Does Differently

ForecastHub isn't trying to compete with SAP IBP. It's trying to give the ops team at a mid-market retailer the same core capability — statistically sound forecasts, automatic safety stock and reorder point calculations, and an AI advisor they can actually talk to — at a cost of zero.

The design priorities reflect what I wish we had:

**Real forecasts, not averages.** AutoARIMA automatically identifies trend, seasonality, and autocorrelation. SeasonalNaive provides robustness for strongly periodic data. The ensemble of the two, with 80% and 95% prediction intervals, gives the user both a point estimate and an honest picture of uncertainty. A manager who sees a wide confidence band knows to hold more safety stock. That's actionable information a spreadsheet average never provides.

**Inventory math built in.** Safety stock, reorder points, and economic order quantity are not exotic concepts — they're undergraduate supply chain formulas — but they're tedious to implement correctly in spreadsheets. ForecastHub computes them automatically from the forecast data and highlights which SKUs are below their reorder point before the ops coordinator even thinks to check.

**Plain-English queries.** The hardest part of analytics is the last mile: turning numbers into decisions. The AI advisor connects Claude to live inventory data so a user can ask "which SKUs should I reorder this week?" or "how many days of stock does SKU-1001 have?" and get a grounded, data-cited answer in seconds. No query language. No pivot tables. Just a question and an answer.

**Zero friction to start.** Clone the repo, run two commands, and there's a working dashboard with sample data. No database to provision. No cloud account to configure. No consultants. That low barrier to entry matters — tools only create value when people actually use them.

## Who This Is For

ForecastHub is for operations teams at mid-size retailers, DTC brands, marketplace sellers, food and beverage chains, and anyone else managing multi-SKU inventory where spreadsheet-based forecasting is causing real pain and enterprise software is out of reach. It's also for data engineers and ML practitioners who want a solid starting point for a forecasting application they can customize and extend.

The only paid component is the optional Anthropic API for the AI advisor. Everything else — the forecasting engine, the inventory logic, the dashboard — is free and open-source, forever.
