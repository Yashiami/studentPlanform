package routing

import (
	"net/http"
	"os"
	"strings"

	"studentPlatform/apiFunc"
)

func SetupRouter() *http.ServeMux {
	mux := http.NewServeMux()
	fs := http.FileServer(http.Dir("./frontend"))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		filePath := "./frontend" + r.URL.Path
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			http.ServeFile(w, r, "./frontend/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	})
	mux.HandleFunc("/read", withCORS(apiFunc.PrepareData))
	mux.HandleFunc("/build", withCORS(apiFunc.BuildCharts))
	mux.HandleFunc("/export", withCORS(apiFunc.ExportReport))
	mux.HandleFunc("/compare", withCORS(apiFunc.CompareHandler))
	mux.HandleFunc("/tables", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			apiFunc.ListTables(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}))

	mux.HandleFunc("/tables/", withCORS(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		switch {
		case strings.HasSuffix(path, "/profile"):
			apiFunc.TableProfileHandler(w, r)
		case strings.HasSuffix(path, "/preview"):
			apiFunc.TablePreview(w, r)
		case strings.HasSuffix(path, "/duplicates"):
			apiFunc.TableDuplicates(w, r)
		default:
			if r.Method == http.MethodDelete {
				apiFunc.DeleteTable(w, r)
			} else {
				http.Error(w, "not found", http.StatusNotFound)
			}
		}
	}))

	mux.HandleFunc("/reports", withCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			apiFunc.SaveReport(w, r)
		case http.MethodGet:
			apiFunc.ListReports(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	mux.HandleFunc("/reports/", withCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			apiFunc.GetReport(w, r)
		case http.MethodDelete:
			apiFunc.DeleteReport(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	return mux
}

func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}
