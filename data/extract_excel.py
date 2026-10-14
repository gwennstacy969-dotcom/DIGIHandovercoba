import zipfile
import xml.etree.ElementTree as ET
import json
import re
import os

def extract():
    excel_path = os.path.join(os.path.dirname(__file__), 'Laporan_Handover_15Agu_13Okt_2026.xlsx')
    out_path = os.path.join(os.path.dirname(__file__), 'extracted_handovers.json')
    
    print(f"Reading {excel_path}...")
    z = zipfile.ZipFile(excel_path)
    
    # 1. Shared Strings
    sst_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    sst = []
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    for si in sst_root.findall(f'{ns}si'):
        # Can have direct <t> or nested in <r><t>
        texts = [t.text for t in si.iter(f'{ns}t') if t.text]
        sst.append(''.join(texts))
    
    print(f"Shared strings count: {len(sst)}")
    
    # 2. Sheet 1: Laporan Handover
    sheet1_root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    handovers = []
    
    rows = list(sheet1_root.iter(f'{ns}row'))
    print(f"Total rows in Sheet 1: {len(rows)}")
    
    # Rows 0-3 are header. Row 4 onwards are data
    for row in rows[4:]:
        cols = {}
        for c in row.findall(f'{ns}c'):
            r = c.attrib.get('r', '')
            col_letter = ''.join([ch for ch in r if ch.isalpha()])
            t = c.attrib.get('t')
            v_elem = c.find(f'{ns}v')
            val = v_elem.text if v_elem is not None else ''
            if t == 's' and val.isdigit():
                val = sst[int(val)]
            cols[col_letter] = val.strip()
        
        # A: ID Handover, B: Tanggal & Waktu, C: No. Polisi, D: Kru AMT
        # E: AMT 1, F: AMT 2, G: Diinput Oleh, H: Jabatan
        # I: Tipe Handover, J: Shift, K: Status Kondisi, L: Status Operasional
        # M: Lokasi/GPS, N: Catatan Handover, O: Komponen Temuan, P: Kategori Temuan
        # Q: Detail Kerusakan, R: Status Follow Up, S: Diverifikasi Oleh, T: Waktu Verifikasi
        
        handover_no = cols.get('A', '')
        if not handover_no:
            continue
            
        time_str = cols.get('B', '')
        no_polisi = cols.get('C', '')
        amt1 = cols.get('E', '')
        amt2 = cols.get('F', '')
        diinput_oleh = cols.get('G', '')
        jabatan = cols.get('H', '')
        tipe_raw = cols.get('I', '')
        tipe = 'mulai' if 'mulai' in tipe_raw.lower() else 'akhiri'
        shift = cols.get('J', '')
        status_kondisi = cols.get('K', '')
        status_operasional = cols.get('L', '')
        lokasi_gps = cols.get('M', '')
        notes = cols.get('N', '')
        komponen = cols.get('O', '')
        kategori = cols.get('P', '')
        detail_kerusakan = cols.get('Q', '')
        status_follow_up = cols.get('R', '')
        diverifikasi_oleh = cols.get('S', '')
        waktu_verifikasi = cols.get('T', '')
        
        # Parse lat/lng from lokasi_gps e.g. "Fuel Terminal Maos (-7.61847, 109.14446)"
        lat, lng = -7.6187, 109.1442
        m = re.search(r'\(([-0-9\.]+),\s*([-0-9\.]+)\)', lokasi_gps)
        if m:
            lat = float(m.group(1))
            lng = float(m.group(2))
            
        has_issue = (komponen != '-' and komponen != '' and komponen != 'Komponen Temuan')
        
        handovers.append({
            'handoverNo': handover_no,
            'time': time_str,
            'noPolisi': no_polisi,
            'amt1': amt1,
            'amt2': amt2,
            'diinputOleh': diinput_oleh,
            'jabatan': jabatan,
            'type': tipe,
            'shift': shift,
            'statusKondisi': status_kondisi,
            'statusOperasional': status_operasional,
            'lat': lat,
            'lng': lng,
            'notes': notes,
            'hasIssue': has_issue,
            'komponen': komponen if has_issue else None,
            'kategori': kategori if has_issue else None,
            'detailKerusakan': detail_kerusakan if has_issue else None,
            'statusFollowUp': status_follow_up if has_issue else None,
            'diverifikasiOleh': diverifikasi_oleh if has_issue else None,
            'waktuVerifikasi': waktu_verifikasi if has_issue else None
        })
        
    print(f"Extracted {len(handovers)} handovers.")
    
    # Write to JSON
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(handovers, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {out_path} ({os.path.getsize(out_path)} bytes).")

if __name__ == '__main__':
    extract()
