package apiFunc

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"studentPlatform/database"
	"studentPlatform/helperFunc"
	"studentPlatform/models"
)

func SaveReport(w http.ResponseWriter, r *http.Request) {
	var req models.SaveReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.TableName == "" {
		http.Error(w, "name and table_name are required", http.StatusBadRequest)
		return
	}

	configJSON, _ := json.Marshal(req.Config)
	dataJSON, _ := json.Marshal(req.Data)

	var id int
	err := database.DB.QueryRow(
		`INSERT INTO _reports (name, table_name, config, data, created_at)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		req.Name, req.TableName, string(configJSON), string(dataJSON), time.Now(),
	).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf("save error: %v", err), http.StatusInternalServerError)
		return
	}

	helperFunc.RespondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "name": req.Name})
}

func ListReports(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT id, name, table_name, created_at FROM _reports ORDER BY created_at DESC`,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ReportMeta struct {
		ID        int       `json:"id"`
		Name      string    `json:"name"`
		TableName string    `json:"table_name"`
		CreatedAt time.Time `json:"created_at"`
	}
	var list []ReportMeta
	for rows.Next() {
		var m ReportMeta
		_ = rows.Scan(&m.ID, &m.Name, &m.TableName, &m.CreatedAt)
		list = append(list, m)
	}
	helperFunc.RespondJSON(w, http.StatusOK, list)
}

func GetReport(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/reports/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var report models.Report
	err = database.DB.QueryRow(
		`SELECT id, name, table_name, config, data, created_at FROM _reports WHERE id=$1`, id,
	).Scan(&report.ID, &report.Name, &report.TableName, &report.Config, &report.Data, &report.CreatedAt)
	if err == sql.ErrNoRows {
		http.Error(w, "report not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var config models.RequestPayload
	var data []models.ChartResponse
	_ = json.Unmarshal([]byte(report.Config), &config)
	_ = json.Unmarshal([]byte(report.Data), &data)

	helperFunc.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":         report.ID,
		"name":       report.Name,
		"table_name": report.TableName,
		"created_at": report.CreatedAt,
		"config":     config,
		"data":       data,
	})
}

func DeleteReport(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/reports/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	_, err = database.DB.Exec("DELETE FROM _reports WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, map[string]interface{}{"deleted": id})
}
