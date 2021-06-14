import { Component } from '@angular/core';

import { ReadFile, ReadMode } from 'ngx-file-helpers';

import * as Papa from 'papaparse';

import { saveAs } from 'file-saver'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'wise-ynab-importer';
  readMode = ReadMode.arrayBuffer;
  transactions: Transaction[];
  displayedColumns = [
    "type",
    "recordDate",
    "valueDate",
    "id",
    "amount",
    "payee",
    "note1",
    "note2",
    "note3",
  ];

  constructor() {}

  onFileLoad(file) {
    const text = new TextDecoder('windows-1250').decode(file.content);
    Papa.parse(text, {
      delimiter: ";",
      complete: (data) => {
        console.log("Parsed data", data);
        let csvRows = data.data;
        // Ignore "Könyvelésre váró tételek"
        while (csvRows.length) {
          const header = csvRows.shift();
          if (header[0] === "Könyvelt tételek") {
            // Ignore table header
            csvRows.shift();
            break;
          }
        }

        let transactions: Transaction[] = [];
        for (let csvRow of csvRows) {
          if (csvRow[0] === "") {
            break;
          }
          const transaction = new Transaction(csvRow);
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
    const blob = new Blob([csvText], {type: "text/csv;charset=utf-8"});
    saveAs(blob, 'ynab-import.csv');
  }
}

// Típus;Könyvelés dátuma;Értéknap;Azonosító;Összeg;Közlemény/1;Közlemény/2;Közlemény/3;Közlemény/4;;
class Transaction {
  private type: string;
  private recordDate: Date;
  private valueDate: Date;
  private id: string;
  private amount: number;
  private note1: string;
  private payee: string;
  private note2: string;
  private note3: string;

  constructor(row) {
    this.type = row[0];
    this.recordDate = parseDate(row[1]);
    this.valueDate = parseDate(row[2]);
    this.id = row[3];
    this.amount = parseAmount(row[4]);
    this.note1 = row[5];
    this.payee = row[6];
    this.note2 = row[7];
    this.note3 = row[8];
  }

  toYnab() {
    // Date,Payee,Category,Memo,Outflow,Inflow
    return [
      this.valueDate.toLocaleString("en-US").split(",")[0],
      this.payee,
      "",
      this.mergeNotes(),
      this.amount < 0 ? -this.amount : "",
      this.amount >= 0 ? this.amount : "",
    ];
  }

  private mergeNotes() {
    if (!this.note2 && !this.note3) {
      return this.note1;
    } else if (!this.note3) {
      return this.note2;
    } else {
      return this.note2 + " / " + this.note3;
    }
  }
}

function parseDate(date: string): Date {
  const matcher = /(\d{4})\.(\d{2})\.(\d{2})\., \w+/.exec(date);
  return new Date(+matcher[1], +matcher[2] - 1, +matcher[3]);
}

function parseAmount(amount: string): number {
  const matcher = /(-?[\d\s]+)(?:,(\d+))? (\w+)/.exec(amount);
  let result = +(matcher[1].replace(/\s+/g, ""));
  if (matcher[2]) {
    result += +matcher[2] / 100 * Math.sign(result + 0.5);
  }
  return result;
}
