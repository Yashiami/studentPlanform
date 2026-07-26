package apiFunc

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"studentPlatform/helperFunc"

	"github.com/xuri/excelize/v2"
)

type ImportResponse struct {
	TableName    string `json:"table_name"`
	RowsImported int    `json:"rows_imported"`
	ColumnsCount int    `json:"columns_count"`
	Size         string `json:"size"`
	Message      string `json:"message"`
}

func PrepareData(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "cannot parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file field missing", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	tableName := helperFunc.SanitizeTableName(header.Filename)

	var parsed *ParsedFile
	switch ext {
	case ".csv":
		parsed, err = ParseCSV(file)
	case ".xlsx":
		parsed, err = parseXLSX(file, header)
	case ".json":
		parsed, err = ParseJSON(file)
	default:
		http.Error(w, fmt.Sprintf("unsupported file format: %s", ext), http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf("parse error: %v", err), http.StatusUnprocessableEntity)
		return
	}

	types := helperFunc.InferColumnTypes(parsed.Records)
	if err := helperFunc.CreateTable(tableName, parsed.Headers, types); err != nil {
		http.Error(w, fmt.Sprintf("create table error: %v", err), http.StatusInternalServerError)
		return
	}

	if err := helperFunc.InsertDataToDatabase(tableName, parsed.Headers, parsed.Records); err != nil {
		http.Error(w, fmt.Sprintf("insert error: %v", err), http.StatusInternalServerError)
		return
	}

	rowsImported := len(parsed.Records)
	columnsCount := len(parsed.Headers)

	response := ImportResponse{
		TableName:    tableName,
		RowsImported: rowsImported,
		ColumnsCount: columnsCount,
		Size:         fmt.Sprintf("%d KB", (header.Size / 1024)),
		Message:      fmt.Sprintf("Таблиця успішно створена з %d рядками та %d колонками", rowsImported, columnsCount),
	}

	helperFunc.RespondJSON(w, http.StatusOK, response)
}

func parseXLSX(file multipart.File, header *multipart.FileHeader) (*ParsedFile, error) {

	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, err
	}
	sheets := f.GetSheetList()
	rows, err := f.GetRows(sheets[0])
	if err != nil || len(rows) < 2 {
		return nil, fmt.Errorf("xlsx: empty or invalid")
	}
	return &ParsedFile{Headers: rows[0], Records: rows[1:]}, nil
}
