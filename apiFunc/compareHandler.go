package apiFunc

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"

	"studentPlatform/database"
	"studentPlatform/helperFunc"
	"studentPlatform/models"
)

func CompareHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CompareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.TableA == "" || req.TableB == "" || req.GroupBy == "" {
		http.Error(w, "table_a, table_b and group_by are required", http.StatusBadRequest)
		return
	}

	for _, t := range []string{req.TableA, req.TableB, req.GroupBy} {
		if err := helperFunc.ValidateIdentifier(t); err != nil {
			http.Error(w, fmt.Sprintf("invalid identifier %q: %v", t, err), http.StatusBadRequest)
			return
		}
	}

	op := strings.ToUpper(req.Operation)
	if op == "" {
		op = "COUNT"
	}
	allowedOps := map[string]bool{"COUNT": true, "SUM": true, "AVG": true, "MIN": true, "MAX": true}
	if !allowedOps[op] {
		http.Error(w, "invalid operation", http.StatusBadRequest)
		return
	}

	queryA, queryB := buildCompareQuery(req.TableA, req.GroupBy, op, req.Field),
		buildCompareQuery(req.TableB, req.GroupBy, op, req.Field)

	mapA, err := fetchGroupMap(queryA)
	if err != nil {
		http.Error(w, fmt.Sprintf("table_a query error: %v", err), http.StatusInternalServerError)
		return
	}
	mapB, err := fetchGroupMap(queryB)
	if err != nil {
		http.Error(w, fmt.Sprintf("table_b query error: %v", err), http.StatusInternalServerError)
		return
	}

	allGroups := map[string]struct{}{}
	for k := range mapA {
		allGroups[k] = struct{}{}
	}
	for k := range mapB {
		allGroups[k] = struct{}{}
	}

	var result []models.CompareRow
	for g := range allGroups {
		vA := mapA[g]
		vB := mapB[g]
		delta := vB - vA
		deltaP := 0.0
		if vA != 0 {
			deltaP = math.Round(delta/vA*10000) / 100
		}
		result = append(result, models.CompareRow{
			Group:        g,
			ValueA:       math.Round(vA*100) / 100,
			ValueB:       math.Round(vB*100) / 100,
			Delta:        math.Round(delta*100) / 100,
			DeltaPercent: deltaP,
		})
	}

	helperFunc.RespondJSON(w, http.StatusOK, models.CompareResponse{
		TableA: req.TableA,
		TableB: req.TableB,
		Field:  req.GroupBy,
		Data:   result,
	})
}

func buildCompareQuery(tableName, groupBy, op, field string) string {
	aggExpr := ""
	if field == "" || field == "*" || op == "COUNT" {
		aggExpr = fmt.Sprintf("COUNT(*)")
	} else {
		aggExpr = fmt.Sprintf("%s(%q)", op, field)
	}
	return fmt.Sprintf(
		"SELECT %q::TEXT AS grp, %s AS val FROM %q GROUP BY %q",
		groupBy, aggExpr, tableName, groupBy,
	)
}

func fetchGroupMap(query string) (map[string]float64, error) {
	rows, err := database.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]float64{}
	for rows.Next() {
		var grp string
		var val float64
		if err := rows.Scan(&grp, &val); err != nil {
			continue
		}
		result[grp] = val
	}
	return result, nil
}
