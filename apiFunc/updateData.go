package apiFunc

import (
	"encoding/json"
	"net/http"

	"studentPlatform/helperFunc"
	"studentPlatform/models"
)

func BuildCharts(w http.ResponseWriter, r *http.Request) {
	var payload models.RequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	tableName := payload.TableName
	if tableName == "" {
		http.Error(w, "table_name is required", http.StatusBadRequest)
		return
	}
	if err := helperFunc.ValidateIdentifier(tableName); err != nil {
		http.Error(w, "invalid tableName", http.StatusBadRequest)
		return
	}

	var responses []models.ChartResponse
	for _, cfg := range payload.DashboardConfiguration {
		query, args, err := helperFunc.BuildSqlQuery(tableName, cfg)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		resp, err := helperFunc.ResponseWithData(tableName, query, args, cfg)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		responses = append(responses, resp)
	}

	helperFunc.RespondJSON(w, http.StatusOK, responses)
}
