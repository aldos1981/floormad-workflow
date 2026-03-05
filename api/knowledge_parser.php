<?php
/**
 * Floormad Workflow - Knowledge File Parser
 * Parses CSV, Excel (via simple processing), PDF (basic), TXT/MD/JSON.
 */

/**
 * Parse uploaded file content and return extracted text.
 * 
 * @param string $tmp_path Path to the uploaded temp file
 * @param string $filename Original filename
 * @return array ['success' => bool, 'text' => string, 'filename' => string, 'chars' => int]
 */
function parse_knowledge_file($tmp_path, $filename)
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $text = '';

    try {
        switch ($ext) {
            case 'csv':
                $handle = fopen($tmp_path, 'r');
                if ($handle) {
                    $rows = [];
                    while (($row = fgetcsv($handle)) !== false) {
                        $rows[] = implode(', ', $row);
                    }
                    fclose($handle);
                    $text = implode("\n", $rows);
                }
                break;

            case 'xlsx':
            case 'xls':
                // Simple XLSX parser without PhpSpreadsheet
                // Uses zip + XML parsing for xlsx
                if ($ext === 'xlsx') {
                    $text = parse_xlsx_simple($tmp_path);
                } else {
                    $text = "[ERROR] .xls format not supported. Please convert to .xlsx or .csv";
                }
                break;

            case 'pdf':
                // Basic PDF text extraction
                $text = parse_pdf_simple($tmp_path);
                break;

            case 'txt':
            case 'md':
            case 'json':
                $text = file_get_contents($tmp_path);
                break;

            default:
                return ['success' => false, 'error' => "Unsupported file type: $filename"];
        }

        $text = trim($text);
        if (empty($text)) {
            return ['success' => false, 'error' => 'No text could be extracted from the file.'];
        }

        return [
            'success' => true,
            'text' => $text,
            'filename' => $filename,
            'chars' => strlen($text)
        ];

    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Simple XLSX parser using PHP's ZipArchive and XML parsing.
 * Reads all sheets and extracts cell values.
 */
function parse_xlsx_simple($file_path)
{
    if (!class_exists('ZipArchive')) {
        return "[ERROR] ZipArchive not available. Cannot parse XLSX files.";
    }

    $zip = new ZipArchive();
    if ($zip->open($file_path) !== true) {
        return "[ERROR] Cannot open XLSX file.";
    }

    // Read shared strings
    $shared_strings = [];
    $sst_xml = $zip->getFromName('xl/sharedStrings.xml');
    if ($sst_xml) {
        $sst = new SimpleXMLElement($sst_xml);
        foreach ($sst->si as $si) {
            $shared_strings[] = (string) $si->t;
        }
    }

    // Read worksheets
    $all_text = [];
    $sheet_index = 1;

    while (true) {
        $sheet_xml = $zip->getFromName("xl/worksheets/sheet{$sheet_index}.xml");
        if (!$sheet_xml)
            break;

        $all_text[] = "--- Sheet $sheet_index ---";
        $sheet = new SimpleXMLElement($sheet_xml);

        if (isset($sheet->sheetData->row)) {
            foreach ($sheet->sheetData->row as $row) {
                $row_values = [];
                foreach ($row->c as $cell) {
                    $value = '';
                    $type = (string) $cell['t'];

                    if ($type === 's' && isset($cell->v)) {
                        // Shared string
                        $idx = (int) $cell->v;
                        $value = $shared_strings[$idx] ?? '';
                    } elseif (isset($cell->v)) {
                        $value = (string) $cell->v;
                    }

                    $row_values[] = $value;
                }
                $row_text = implode(', ', $row_values);
                if (trim($row_text, ', ')) {
                    $all_text[] = $row_text;
                }
            }
        }

        $sheet_index++;
    }

    $zip->close();

    if (count($all_text) <= 1) {
        return "[ERROR] No data found in XLSX file.";
    }

    return implode("\n", $all_text);
}

/**
 * Basic PDF text extraction.
 * Looks for text streams between BT/ET markers.
 */
function parse_pdf_simple($file_path)
{
    $content = file_get_contents($file_path);

    // Try to find text objects (between BT and ET)
    $text = '';

    // Simple regex-based text extraction for non-compressed PDFs
    if (preg_match_all('/\((.*?)\)/', $content, $matches)) {
        $extracted = [];
        foreach ($matches[1] as $match) {
            $clean = preg_replace('/[^\x20-\x7E\xA0-\xFF]/', '', $match);
            if (strlen(trim($clean)) > 1) {
                $extracted[] = $clean;
            }
        }
        $text = implode(' ', $extracted);
    }

    if (empty(trim($text))) {
        $text = "[PDF content not fully readable - basic parser only. For best results, convert to TXT or CSV first.]";
    }

    return $text;
}
