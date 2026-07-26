package apiFunc

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/saintfish/chardet"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
)

type ParsedFile struct {
	Headers []string
	Records [][]string
}

func ParseCSV(r io.Reader) (*ParsedFile, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read error: %w", err)
	}

	detector := chardet.NewTextDetector()
	result, err := detector.DetectBest(data)
	if err == nil && strings.Contains(strings.ToLower(result.Charset), "windows-1251") {
		decoder := charmap.Windows1251.NewDecoder()
		decoded, _, err := transform.Bytes(decoder, data)
		if err == nil {
			data = decoded
		}
	}

	separator := detectSeparator(data)

	reader := csv.NewReader(strings.NewReader(string(data)))
	reader.Comma = separator
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	all, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("csv parse error: %w", err)
	}
	if len(all) < 2 {
		return nil, fmt.Errorf("CSV must have at least a header row and one data row")
	}

	return &ParsedFile{Headers: all[0], Records: all[1:]}, nil
}

func ParseJSON(r io.Reader) (*ParsedFile, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	var records []map[string]interface{}
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("invalid JSON: expected array of objects: %w", err)
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("JSON array is empty")
	}

	var headers []string
	for k := range records[0] {
		headers = append(headers, k)
	}

	var rows [][]string
	for _, rec := range records {
		var row []string
		for _, h := range headers {
			row = append(row, fmt.Sprintf("%v", rec[h]))
		}
		rows = append(rows, row)
	}

	return &ParsedFile{Headers: headers, Records: rows}, nil
}

func detectSeparator(data []byte) rune {
	firstLine := ""
	for i, b := range data {
		if b == '\n' || i > 2000 {
			break
		}
		firstLine += string(rune(b))
	}
	counts := map[rune]int{';': 0, ',': 0, '\t': 0, '|': 0}
	for _, c := range firstLine {
		if _, ok := counts[c]; ok {
			counts[c]++
		}
	}
	best := ';'
	bestCount := 0
	for sep, cnt := range counts {
		if cnt > bestCount {
			bestCount = cnt
			best = sep
		}
	}
	return best
}
