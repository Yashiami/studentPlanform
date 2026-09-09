package helperFunc

import (
	"strings"
	"testing"

	"studentPlatform/models"
)

func TestBuildSqlQuery_GroupByWithAggregation(t *testing.T) {
	config := models.ChartConfig{
		GroupBy: []string{"dept"},
		Aggregations: []models.Aggregation{
			{Field: "score", Operation: "avg"},
		},
		Limit: 10,
	}

	query, args, err := BuildSqlQuery("students", config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := `SELECT "dept", AVG("score") AS "avg_score" FROM "students" WHERE "dept" IS NOT NULL AND "dept"::text <> '' GROUP BY "dept" LIMIT 10`
	if query != want {
		t.Errorf("query mismatch:\n got: %s\nwant: %s", query, want)
	}
	if len(args) != 0 {
		t.Errorf("expected no args, got %v", args)
	}
}

func TestBuildSqlQuery_Filters(t *testing.T) {
	config := models.ChartConfig{
		Filters: []models.Filter{
			{Field: "age", Operator: ">", Value: 18},
		},
	}

	query, args, err := BuildSqlQuery("students", config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(query, `SELECT * FROM "students"`) {
		t.Errorf("expected SELECT * FROM \"students\", got: %s", query)
	}
	if !strings.Contains(query, `"age" > $1`) {
		t.Errorf("expected filter condition, got: %s", query)
	}
	if len(args) != 1 || args[0] != 18 {
		t.Errorf("expected args [18], got %v", args)
	}
}

func TestBuildSqlQuery_InvalidGroupByIdentifier(t *testing.T) {
	config := models.ChartConfig{
		GroupBy: []string{`bad"field`},
	}

	_, _, err := BuildSqlQuery("students", config)
	if err == nil {
		t.Fatal("expected error for invalid group_by identifier, got nil")
	}
}

func TestBuildSqlQuery_InvalidFilterOperator(t *testing.T) {
	config := models.ChartConfig{
		Filters: []models.Filter{
			{Field: "age", Operator: "; DROP TABLE students; --"},
		},
	}

	_, _, err := BuildSqlQuery("students", config)
	if err == nil {
		t.Fatal("expected error for invalid filter operator, got nil")
	}
}

func TestBuildSqlQuery_InvalidAggregationOperation(t *testing.T) {
	config := models.ChartConfig{
		Aggregations: []models.Aggregation{
			{Field: "score", Operation: "DELETE"},
		},
	}

	_, _, err := BuildSqlQuery("students", config)
	if err == nil {
		t.Fatal("expected error for invalid aggregation operation, got nil")
	}
}

func TestBuildSqlQuery_Histogram(t *testing.T) {
	config := models.ChartConfig{
		VisualizationType: "histogram",
		BucketField:       "score",
		BucketSize:        5,
	}

	query, args, err := BuildSqlQuery("students", config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(query, `FLOOR("score" / $1) * $2`) {
		t.Errorf("expected histogram bucket expression, got: %s", query)
	}
	if !strings.Contains(query, `FROM "students"`) {
		t.Errorf("expected FROM clause, got: %s", query)
	}
	if !strings.HasSuffix(query, "GROUP BY bucket_start ORDER BY bucket_start") {
		t.Errorf("expected GROUP/ORDER BY suffix, got: %s", query)
	}
	if len(args) != 2 || args[0] != 5.0 || args[1] != 5.0 {
		t.Errorf("expected args [5.0, 5.0], got %v", args)
	}
}

func TestBuildSqlQuery_HistogramDefaultBucketSize(t *testing.T) {
	config := models.ChartConfig{
		VisualizationType: "histogram",
		BucketField:       "score",
		// BucketSize omitted -> should default to 10
	}

	_, args, err := BuildSqlQuery("students", config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(args) != 2 || args[0] != 10.0 {
		t.Errorf("expected default bucket size 10.0, got args %v", args)
	}
}

func TestBuildSqlQuery_HistogramInvalidBucketField(t *testing.T) {
	config := models.ChartConfig{
		VisualizationType: "histogram",
		BucketField:       `bad"field`,
	}

	_, _, err := BuildSqlQuery("students", config)
	if err == nil {
		t.Fatal("expected error for invalid bucket field, got nil")
	}
}
