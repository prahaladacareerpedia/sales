import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

function App() {
  const [data, setData] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const binaryStr = e.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setData(jsonData);
      console.log(jsonData);
    };
    reader.readAsBinaryString(file);
  };

  const generateTallyXML = () => {
    if (!data.length) return;

    const createXml = (data) => {
      const xmlDoc = document.implementation.createDocument('', '', null);
      const envelope = xmlDoc.createElement('ENVELOPE');

      const header = xmlDoc.createElement('HEADER');
      const tallyRequest = xmlDoc.createElement('TALLYREQUEST');
      tallyRequest.textContent = 'Import Data';
      header.appendChild(tallyRequest);
      envelope.appendChild(header);

      const body = xmlDoc.createElement('BODY');
      const importData = xmlDoc.createElement('IMPORTDATA');
      const requestDesc = xmlDoc.createElement('REQUESTDESC');
      const reportName = xmlDoc.createElement('REPORTNAME');
      reportName.textContent = 'Vouchers';
      requestDesc.appendChild(reportName);

      const staticVars = xmlDoc.createElement('STATICVARIABLES');
      const svcCompany = xmlDoc.createElement('SVCURRENTCOMPANY');
      svcCompany.textContent = 'Your Company Name';
      staticVars.appendChild(svcCompany);
      requestDesc.appendChild(staticVars);
      importData.appendChild(requestDesc);

      const requestData = xmlDoc.createElement('REQUESTDATA');

      const groupedData = groupBy(data, 'Invoice No');

      for (const [invoiceNumber, group] of Object.entries(groupedData)) {
        const tallyMessage = xmlDoc.createElement('TALLYMESSAGE');
        const voucher = xmlDoc.createElement('VOUCHER');
        voucher.setAttribute('VCHTYPE', 'Sales');
        voucher.setAttribute('ACTION', 'Create');
        voucher.setAttribute('OBJVIEW', 'Accounting Voucher View');

        const firstEntry = group[0];
        const formattedDate = formatDate(firstEntry['Invoice Date']);

        createElementWithText(voucher, 'DATE', formattedDate);
        createElementWithText(voucher, 'VOUCHERTYPENAME', 'Sales');
        createElementWithText(voucher, 'VOUCHERNUMBER', invoiceNumber);
        createElementWithText(voucher, 'PARTYLEDGERNAME', firstEntry['Party A/C Name']);
        createElementWithText(voucher, 'STATENAME', firstEntry['Place of Supply']);
        createElementWithText(voucher, 'COUNTRYOFRESIDENCE', 'India');

        // Party Ledger (BY)
        const partyLedgerEntry = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
        createElementWithText(partyLedgerEntry, 'LEDGERNAME', firstEntry['Party A/C Name']);
        createElementWithText(partyLedgerEntry, 'ISDEEMEDPOSITIVE', 'Yes');
        const totalAmount = group.reduce(
          (sum, row) => sum + row['Taxable Value'] + (row['IGST'] || 0) + (row['Cgst'] || 0) + (row['Sgst'] || 0),
          0
        );
        createElementWithText(partyLedgerEntry, 'AMOUNT', `-${totalAmount.toFixed(2)}`);
        voucher.appendChild(partyLedgerEntry);

        // Sales and Tax Ledger Entries (TO)
        group.forEach(row => {
          const salesLedgerEntry = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
          createElementWithText(salesLedgerEntry, 'LEDGERNAME', row['ITEM']);
          createElementWithText(salesLedgerEntry, 'ISDEEMEDPOSITIVE', 'No');
          createElementWithText(salesLedgerEntry, 'AMOUNT', row['Taxable Value'].toFixed(2));
          voucher.appendChild(salesLedgerEntry);

          if (row['IGST'] > 0) {
            const igstEntry = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
            createElementWithText(igstEntry, 'LEDGERNAME', 'IGST');
            createElementWithText(igstEntry, 'ISDEEMEDPOSITIVE', 'No');
            createElementWithText(igstEntry, 'AMOUNT', row['IGST'].toFixed(2));
            voucher.appendChild(igstEntry);
          } else {
            const cgstEntry = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
            createElementWithText(cgstEntry, 'LEDGERNAME', 'CGST');
            createElementWithText(cgstEntry, 'ISDEEMEDPOSITIVE', 'No');
            createElementWithText(cgstEntry, 'AMOUNT', row['Cgst'].toFixed(2));
            voucher.appendChild(cgstEntry);

            const sgstEntry = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
            createElementWithText(sgstEntry, 'LEDGERNAME', 'SGST');
            createElementWithText(sgstEntry, 'ISDEEMEDPOSITIVE', 'No');
            createElementWithText(sgstEntry, 'AMOUNT', row['Sgst'].toFixed(2));
            voucher.appendChild(sgstEntry);
          }
        });

        tallyMessage.appendChild(voucher);
        requestData.appendChild(tallyMessage);
      }

      importData.appendChild(requestData);
      body.appendChild(importData);
      envelope.appendChild(body);
      xmlDoc.appendChild(envelope);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    };

    const xmlContent = createXml(data);
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    saveAs(blob, 'SalesData.xml');
  };

  const createElementWithText = (parent, tagName, text) => {
    const element = document.createElement(tagName);
    element.textContent = text;
    parent.appendChild(element);
  };

  const groupBy = (array, key) => {
    return array.reduce((result, currentValue) => {
      (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
      return result;
    }, {});
  };

  const formatDate = (dateStr) => {
    return dateStr; // Format already YYYYMMDD
  };

  return (
    <div className="App">
      <h1>Excel to Tally XML Converter - Sales</h1>
      <input type="file" onChange={handleFileUpload} />
      <button onClick={generateTallyXML}>Generate Tally XML</button>
    </div>
  );
}

export default App;
