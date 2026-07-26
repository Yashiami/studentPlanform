package apiFunc

import (
	"net/http"
	"strconv"
	"strings"

	"studentPlatform/helperFunc"
)

func ListTables(w http.ResponseWriter, r *http.Request) {
	tables, err := helperFunc.ListUserTables()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, tables)
}

func TableProfileHandler(w http.ResponseWriter, r *http.Request) {
	name := extractPathParam(r.URL.Path, "/tables/", "/profile")
	if name == "" {
		http.Error(w, "table name missing", http.StatusBadRequest)
		return
	}
	profile, err := helperFunc.BuildTableProfile(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, profile)
}

func TablePreview(w http.ResponseWriter, r *http.Request) {
	name := extractPathParam(r.URL.Path, "/tables/", "/preview")
	if name == "" {
		http.Error(w, "table name missing", http.StatusBadRequest)
		return
	}
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	rows, err := helperFunc.PreviewTable(name, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, rows)
}

func DeleteTable(w http.ResponseWriter, r *http.Request) {
	name := extractPathParam(r.URL.Path, "/tables/", "")
	if name == "" {
		http.Error(w, "table name missing", http.StatusBadRequest)
		return
	}
	if err := helperFunc.DropTable(name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, map[string]string{"deleted": name})
}

func TableDuplicates(w http.ResponseWriter, r *http.Request) {
	name := extractPathParam(r.URL.Path, "/tables/", "/duplicates")
	if name == "" {
		http.Error(w, "table name missing", http.StatusBadRequest)
		return
	}
	count, rows, err := helperFunc.FindDuplicates(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	helperFunc.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"total_duplicate_groups": count,
		"rows":                   rows,
	})
}

func extractPathParam(path, prefix, suffix string) string {
	path = strings.TrimPrefix(path, prefix)
	if suffix != "" {
		path = strings.TrimSuffix(path, suffix)
	}
	path = strings.Trim(path, "/")
	return path
}
