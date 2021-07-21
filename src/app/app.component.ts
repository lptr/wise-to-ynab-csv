import { ChangeDetectorRef, Component } from '@angular/core';

import { ReadFile, ReadMode } from 'ngx-file-helpers';

import * as Papa from 'papaparse';

import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'wise-ynab-importer';
  readMode = ReadMode.arrayBuffer;
  transactions: Transaction[] = [];
  eurHufExchangeRate: number;
  displayedColumns = [
    "id",
    "date",
    "amount",
    "hufAmount",
    "description",
  ];

  constructor(private http: HttpClient, private ref: ChangeDetectorRef) { }

  ngOnInit() {
    this.http.get('https://free.currconv.com/api/v7/convert?q=EUR_HUF&compact=ultra&apiKey=e948730e221a03682353').subscribe((data: any) => {
      console.log("Exchange rate: ", data);
      this.eurHufExchangeRate = data.EUR_HUF;
      this.ref.detectChanges();
    });
  }

  onFileLoad(file: any) {
    const text = new TextDecoder('utf-8').decode(file.content);
    Papa.parse(text, {
      delimiter: ",",
      complete: (csv: any) => {
        let csvRows = csv.data;
        csvRows.shift();
        let transactions: Transaction[] = [];
        for (let csvRow of csvRows) {
          if (csvRow[0] === "") {
            break;
          }
          const transaction = new Transaction(csvRow, this.eurHufExchangeRate);
          console.log(transaction);
          transactions.push(transaction);
        }
        this.transactions = transactions;
      }
    });
  }

  download() {
    const ynabTransactions = this.transactions.map(transaction => transaction.toYnab());
    ynabTransactions.unshift(["Date", "Payee", "Category", "Memo", "Outflow", "Inflow"]);
    const csvText = Papa.unparse(ynabTransactions, {
      delimiter: ",",
    });
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    saveAs(blob, 'ynab-import.csv');
  }
}

// TransferWise ID	Date	Amount	Currency	Description	Payment Reference	Running Balance	Exchange From	Exchange To	Exchange Rate	Payer Name	Payee Name	Payee Account Number	Merchant	Total fees
class Transaction {
  private id: string;
  private date: Date;
  private amount: number;
  private currency: string;
  private hufAmount: number;
  private description: string;
  private reference: string;
  private runningBalance: number;
  private exchangeFrom: string | null;
  private exchangeTo: string | null;
  private exchangeRate: number | null;
  private payerName: string | null;
  private payeeName: string | null;
  private payeeAccountNumber: string | null;
  private merchant: string | null;
  private totalFees: number;

  constructor(row: Array<any>, eurHufExchangeRate: number) {
    this.id = row[0];
    this.date = parseDate(row[1]);
    this.amount = row[2];
    this.currency = row[3];
    this.description = row[4];
    this.reference = row[5];
    this.runningBalance = row[6];
    this.exchangeFrom = row[7];
    this.exchangeTo = row[8];
    this.exchangeRate = row[9];
    this.payerName = row[10];
    this.payeeName = row[11];
    this.payeeAccountNumber = row[12];
    this.merchant = row[13];
    this.totalFees = row[14];
    this.hufAmount = calculateHufAmount(eurHufExchangeRate, this.currency, this.amount);
  }

  toYnab() {
    // Date,Payee,Category,Memo,Outflow,Inflow
    return [
      this.date.toLocaleString("en-US").split(",")[0],
      this.mergePayee(),
      "",
      this.description,
      this.hufAmount < 0 ? -this.hufAmount : "",
      this.hufAmount >= 0 ? this.hufAmount : "",
    ];
  }

  private mergePayee() {
    if (this.payeeName) {
      return this.payeeName;
    } if (this.payerName) {
      return this.payerName;
    } else {
      return this.merchant;
    }
  }
}

function calculateHufAmount(eurHufExchangeRate: number, currency: string, amount: number) {
  if (currency === "HUF") {
    return amount;
  } else if (currency === "EUR") {
    return amount * eurHufExchangeRate;
  } else {
    throw new Error("Unsupported currency: " + currency);
  }
}

function parseDate(date: string): Date {
  const matcher = /(\d\d)\-(\d\d)\-(\d{4})/.exec(date);
  return new Date(+matcher[3], +matcher[2] - 1, +matcher[1]);
}
