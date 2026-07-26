package apiFunc

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"studentPlatform/helperFunc"
	"studentPlatform/models"
)

const API_BASE = "http://localhost:8080"

func ExportReport(w http.ResponseWriter, r *http.Request) {
	var payload models.RequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	tableName := payload.TableName
	if tableName == "" {
		http.Error(w, "table_name is required in request body", http.StatusBadRequest)
		return
	}

	if err := helperFunc.ValidateIdentifier(tableName); err != nil {
		http.Error(w, "invalid table_name", http.StatusBadRequest)
		return
	}

	var responses []models.ChartResponse
	for _, cfg := range payload.DashboardConfiguration {
		query, args, err := helperFunc.BuildSqlQuery(tableName, cfg)
		if err != nil {
			http.Error(w, fmt.Sprintf("build query error: %v", err), http.StatusBadRequest)
			return
		}

		resp, err := helperFunc.ResponseWithData(tableName, query, args, cfg)
		if err != nil {
			http.Error(w, fmt.Sprintf("query execution error: %v", err), http.StatusInternalServerError)
			return
		}

		responses = append(responses, resp)
	}

	docxPath, err := generateDocx(tableName, responses)
	if err != nil {
		// Дай бачити реальну помилку
		fmt.Fprintf(os.Stderr, "DOCX generation failed: %v\n", err)
		http.Error(w, fmt.Sprintf("docx generation error: %v", err), http.StatusInternalServerError)
		return
	}
	defer os.Remove(docxPath)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="report_%s.docx"`, tableName))
	http.ServeFile(w, r, docxPath)
}

type ExportData struct {
	TableName string                 `json:"table_name"`
	Generated string                 `json:"generated"`
	Charts    []models.ChartResponse `json:"charts"`
}

func generateDocx(tableName string, responses []models.ChartResponse) (string, error) {
	exportData := ExportData{
		TableName: tableName,
		Generated: "2025-01-01", // TODO: поточна дата
		Charts:    responses,
	}

	tmpDataFile := filepath.Join(os.TempDir(), "export_data.json")
	dataBytes, err := json.Marshal(exportData)
	if err != nil {
		return "", fmt.Errorf("json marshal error: %w", err)
	}

	if err := ioutil.WriteFile(tmpDataFile, dataBytes, 0644); err != nil {
		return "", fmt.Errorf("write temp file error: %w", err)
	}
	defer os.Remove(tmpDataFile)

	scriptPath := "scripts/generate_report.js"
	if info, err := os.Stat(scriptPath); err != nil || info.IsDir() {
		// Якщо не в поточній папці, спробуй інші місця
		scriptPath = filepath.Join(".", "scripts", "generate_report.js")
	}

	tmpDocxFile := filepath.Join(os.TempDir(), "report.docx")

	cmd := exec.Command("node", scriptPath, tmpDataFile, tmpDocxFile)
	cmd.Stderr = os.Stderr // Показуй помилки
	cmd.Stdout = os.Stdout // Показуй вихід

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("node script failed: %w", err)
	}

	if _, err := os.Stat(tmpDocxFile); err != nil {
		return "", fmt.Errorf("docx file not created: %w", err)
	}

	return tmpDocxFile, nil
}
