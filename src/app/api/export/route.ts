import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getPortfolios, getModelPortfolios } from "@/lib/gdrive";

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const format = searchParams.get("format");

  if (format !== "csv") {
    return Response.json(
      { error: "Unsupported format. Only 'csv' is supported." },
      { status: 400 }
    );
  }

  if (
    !type ||
    !["portfolios", "model-portfolios", "transactions"].includes(type)
  ) {
    return Response.json(
      {
        error:
          "Invalid type. Must be one of: portfolios, model-portfolios, transactions",
      },
      { status: 400 }
    );
  }

  try {
    let csv: string;
    let filename: string;

    if (type === "portfolios") {
      const portfolios = await getPortfolios();

      const headers = [
        "Symbol",
        "Company",
        "Shares",
        "Avg Price",
        "Portfolio Name",
      ];
      const rows: (string | number)[][] = [];

      for (const portfolio of portfolios) {
        for (const holding of portfolio.holdings) {
          rows.push([
            holding.symbol,
            holding.companyName,
            holding.quantity,
            holding.avgPrice,
            portfolio.name,
          ]);
        }
      }

      csv = toCsv(headers, rows);
      filename = "portfolios-holdings.csv";
    } else if (type === "model-portfolios") {
      const modelPortfolios = await getModelPortfolios();

      const headers = [
        "Model Name",
        "Symbol",
        "Company",
        "Shares",
        "Avg Price",
        "Allocation %",
      ];
      const rows: (string | number)[][] = [];

      for (const model of modelPortfolios) {
        for (const alloc of model.allocations) {
          rows.push([
            model.name,
            alloc.symbol,
            alloc.companyName,
            alloc.shares,
            alloc.avgPrice,
            alloc.percentage,
          ]);
        }
      }

      csv = toCsv(headers, rows);
      filename = "model-portfolios.csv";
    } else {
      const portfolios = await getPortfolios();
      const modelPortfolios = await getModelPortfolios();

      const headers = [
        "Date",
        "Type",
        "Symbol",
        "Company",
        "Quantity",
        "Price",
        "Total",
        "Portfolio",
      ];
      const rows: (string | number)[][] = [];

      for (const p of portfolios) {
        for (const tx of p.transactions) {
          rows.push([
            tx.createdAt.split("T")[0],
            tx.type,
            tx.symbol,
            tx.companyName,
            tx.quantity,
            tx.price,
            tx.total,
            p.name,
          ]);
        }
      }

      for (const m of modelPortfolios) {
        for (const tx of m.transactions) {
          rows.push([
            tx.createdAt.split("T")[0],
            tx.type,
            tx.symbol,
            tx.companyName,
            tx.quantity,
            tx.price,
            tx.total,
            m.name,
          ]);
        }
      }

      rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));

      csv = toCsv(headers, rows);
      filename = "transactions.csv";
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return Response.json({ error: "Failed to export data" }, { status: 500 });
  }
}
