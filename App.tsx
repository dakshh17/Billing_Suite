import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

type LineItem = { id: string; name: string; unitPrice: string; quantity: string };
type Product = { id: string; name: string; unitPrice: number };
type CompanyProfile = { name: string; address: string; contact: string; logoPlaceholder: string };

const STORAGE_KEYS = {
  products: '@ruchi_products',
  invoiceCounter: '@ruchi_invoice_counter',
  companyProfile: '@ruchi_company_profile',
};

const defaultProfile: CompanyProfile = {
  name: 'Ruchi Furniture',
  address: '123 Main Road, City, State',
  contact: '+91-00000-00000 | sales@ruchifurniture.com',
  logoPlaceholder: 'LOGO',
};

export default function App() {
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: uuidv4(), name: '', unitPrice: '', quantity: '1' }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [taxPercent, setTaxPercent] = useState('0');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultProfile);

  useEffect(() => {
    void hydrate();
  }, []);

  const hydrate = async () => {
    const [productsRaw, profileRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.products),
      AsyncStorage.getItem(STORAGE_KEYS.companyProfile),
    ]);
    if (productsRaw) setProducts(JSON.parse(productsRaw) as Product[]);
    if (profileRaw) setCompanyProfile(JSON.parse(profileRaw) as CompanyProfile);
  };

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), 0),
    [lineItems],
  );
  const taxAmount = subtotal * ((Number(taxPercent) || 0) / 100);
  const total = subtotal + taxAmount;

  const updateLineItem = (id: string, key: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, { id: uuidv4(), name: '', unitPrice: '', quantity: '1' }]);
  const removeLineItem = (id: string) => setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));

  const persistProductsFromBill = async () => {
    const updated = [...products];
    lineItems.forEach((item) => {
      const name = item.name.trim();
      const unitPrice = Number(item.unitPrice);
      if (!name || !unitPrice) return;
      const existing = updated.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.unitPrice = unitPrice;
      } else {
        updated.unshift({ id: uuidv4(), name, unitPrice });
      }
    });
    setProducts(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.products, JSON.stringify(updated));
  };

  const validate = () => {
    if (!customerName.trim()) return 'Customer name is required.';
    const invalid = lineItems.some((item) => !item.name.trim() || Number(item.unitPrice) <= 0 || Number(item.quantity) <= 0);
    if (invalid) return 'Each line item needs name, positive price, and positive quantity.';
    return null;
  };

  const getNextInvoiceId = async () => {
    const counterRaw = await AsyncStorage.getItem(STORAGE_KEYS.invoiceCounter);
    const next = (counterRaw ? Number(counterRaw) : 1000) + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.invoiceCounter, String(next));
    return `RF-${next}`;
  };

  const generateHtml = (invoiceId: string) => {
    const rows = lineItems
      .map(
        (item, index) => `<tr><td>${index + 1}</td><td>${item.name}</td><td>₹${Number(item.unitPrice).toFixed(2)}</td><td>${item.quantity}</td><td>₹${(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}</td></tr>`,
      )
      .join('');
    return `
      <html><body style="font-family:Arial;padding:20px;color:#111">
      <div style="border-bottom:2px solid #1f3b73;padding-bottom:10px;margin-bottom:16px">
      <h1 style="margin:0;color:#1f3b73">${companyProfile.logoPlaceholder} ${companyProfile.name}</h1>
      <div>${companyProfile.address}</div><div>${companyProfile.contact}</div></div>
      <h2>Invoice ${invoiceId}</h2>
      <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
      <div><b>Customer:</b> ${customerName} (${customerContact || '-'})</div>
      <table style="width:100%;border-collapse:collapse;margin-top:14px">
      <tr><th>#</th><th>Product</th><th>Unit Price</th><th>Qty</th><th>Amount</th></tr>${rows}
      </table>
      <div style="margin-top:16px;text-align:right">
      <div>Subtotal: ₹${subtotal.toFixed(2)}</div><div>Tax (${taxPercent || 0}%): ₹${taxAmount.toFixed(2)}</div>
      <div style="font-size:20px;font-weight:bold">Total: ₹${total.toFixed(2)}</div></div></body></html>`;
  };

  const generatePdf = async () => {
    const error = validate();
    if (error) return Alert.alert('Validation Error', error);
    const invoiceId = await getNextInvoiceId();
    await persistProductsFromBill();
    const { uri } = await Print.printToFileAsync({ html: generateHtml(invoiceId) });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoiceId}` });
  };

  const generateExcel = async () => {
    const error = validate();
    if (error) return Alert.alert('Validation Error', error);
    const invoiceId = await getNextInvoiceId();
    await persistProductsFromBill();
    const wb = XLSX.utils.book_new();
    const data = [
      [companyProfile.logoPlaceholder, companyProfile.name],
      ['Address', companyProfile.address],
      ['Contact', companyProfile.contact],
      [],
      ['Invoice ID', invoiceId],
      ['Date', new Date().toISOString().split('T')[0]],
      ['Customer', customerName],
      ['Customer Contact', customerContact],
      [],
      ['#', 'Product', 'Unit Price', 'Quantity', 'Amount'],
      ...lineItems.map((item, index) => [index + 1, item.name, Number(item.unitPrice), Number(item.quantity), Number(item.unitPrice) * Number(item.quantity)]),
      [],
      ['', '', '', 'Subtotal', subtotal],
      ['', '', '', `Tax ${taxPercent || 0}%`, taxAmount],
      ['', '', '', 'Total', total],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const path = `${FileSystem.documentDirectory}${invoiceId}.xlsx`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const clearForm = () => {
    setLineItems([{ id: uuidv4(), name: '', unitPrice: '', quantity: '1' }]);
    setCustomerName('');
    setCustomerContact('');
    setTaxPercent('0');
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}><ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ruchi Furniture Billing</Text>
      <TextInput style={styles.input} placeholder="Customer Name" value={customerName} onChangeText={setCustomerName} />
      <TextInput style={styles.input} placeholder="Customer Contact" value={customerContact} onChangeText={setCustomerContact} keyboardType="phone-pad" />
      {lineItems.map((item, idx) => (
        <View style={styles.card} key={item.id}>
          <Text style={styles.cardTitle}>Item {idx + 1}</Text>
          <TextInput style={styles.input} placeholder="Product Name" value={item.name} onChangeText={(v) => updateLineItem(item.id, 'name', v)} />
          <TextInput style={styles.input} placeholder="Unit Price" keyboardType="decimal-pad" value={item.unitPrice} onChangeText={(v) => updateLineItem(item.id, 'unitPrice', v)} />
          <TextInput style={styles.input} placeholder="Quantity" keyboardType="number-pad" value={item.quantity} onChangeText={(v) => updateLineItem(item.id, 'quantity', v)} />
          <Pressable style={styles.removeButton} onPress={() => removeLineItem(item.id)}><Text style={styles.buttonText}>Remove Item</Text></Pressable>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={addLineItem}><Text style={styles.buttonText}>Add Item</Text></Pressable>
      <TextInput style={styles.input} placeholder="Tax %" keyboardType="decimal-pad" value={taxPercent} onChangeText={setTaxPercent} />
      <View style={styles.totals}><Text>Subtotal: ₹{subtotal.toFixed(2)}</Text><Text>Tax: ₹{taxAmount.toFixed(2)}</Text><Text style={styles.total}>Total: ₹{total.toFixed(2)}</Text></View>
      <Pressable style={styles.primaryButton} onPress={generatePdf}><Text style={styles.buttonText}>Generate PDF</Text></Pressable>
      <Pressable style={styles.primaryButton} onPress={generateExcel}><Text style={styles.buttonText}>Generate Excel</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={clearForm}><Text>Clear Form</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => setShowHistory(true)}><Text>View History</Text></Pressable>

      <Text style={styles.subtitle}>Letterhead Setup</Text>
      <TextInput style={styles.input} placeholder="Company Name" value={companyProfile.name} onChangeText={(name) => setCompanyProfile((p) => ({ ...p, name }))} />
      <TextInput style={styles.input} placeholder="Address" value={companyProfile.address} onChangeText={(address) => setCompanyProfile((p) => ({ ...p, address }))} />
      <TextInput style={styles.input} placeholder="Contact" value={companyProfile.contact} onChangeText={(contact) => setCompanyProfile((p) => ({ ...p, contact }))} />
      <TextInput style={styles.input} placeholder="Logo Placeholder" value={companyProfile.logoPlaceholder} onChangeText={(logoPlaceholder) => setCompanyProfile((p) => ({ ...p, logoPlaceholder }))} />
      <Pressable style={styles.secondaryButton} onPress={() => AsyncStorage.setItem(STORAGE_KEYS.companyProfile, JSON.stringify(companyProfile))}><Text>Save Letterhead</Text></Pressable>

      <Modal visible={showHistory} animationType="slide"><SafeAreaView style={styles.container}><TextInput style={styles.input} placeholder="Search product" value={search} onChangeText={setSearch} />
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <Pressable onPress={() => {updateLineItem(lineItems[0].id, 'name', item.name); updateLineItem(lineItems[0].id, 'unitPrice', String(item.unitPrice)); setShowHistory(false);}}>
                <Text>{item.name} - ₹{item.unitPrice.toFixed(2)}</Text>
              </Pressable>
              <Pressable onPress={async () => {const next = products.filter((p) => p.id !== item.id); setProducts(next); await AsyncStorage.setItem(STORAGE_KEYS.products, JSON.stringify(next));}}><Text style={{color:'red'}}>Delete</Text></Pressable>
            </View>
          )}
        />
        <Pressable style={styles.secondaryButton} onPress={() => setShowHistory(false)}><Text>Close</Text></Pressable>
      </SafeAreaView></Modal>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fa' },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f3b73', marginBottom: 12 },
  subtitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: 'white', padding: 12, borderRadius: 10, marginBottom: 10 },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d8dfeb', borderRadius: 8, padding: 10, marginBottom: 8 },
  primaryButton: { backgroundColor: '#1f3b73', padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryButton: { backgroundColor: '#e3e9f5', padding: 12, borderRadius: 8, marginTop: 8 },
  removeButton: { backgroundColor: '#9c2b2b', padding: 10, borderRadius: 8 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '600' },
  totals: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 8 },
  total: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  historyItem: { backgroundColor: 'white', padding: 12, marginVertical: 4, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' },
});
