package helperFunc

import (
	"fmt"
	"math"

	"studentPlatform/models"
)

// EnrichResponse adds summary, data_quality, and insights to the response
func EnrichResponse(
	data []map[string]interface{},
	aggField string,
	tableName string,
	usedFields []string,
) (*models.Summary, *models.DataQuality, []string) {

	summary := buildSummary(data, aggField)
	quality := buildDataQuality(tableName, usedFields)
	insights := buildInsights(summary)

	return summary, quality, insights
}

// AddSharePercent adds share_percent and rank fields to each row
func AddSharePercent(data []map[string]interface{}, aggField string) {
	if aggField == "" || len(data) == 0 {
		return
	}
	var total float64
	for _, row := range data {
		total += toFloat(row[aggField])
	}
	if total == 0 {
		return
	}
	for i, row := range data {
		share := toFloat(row[aggField]) / total * 100
		data[i]["share_percent"] = math.Round(share*100) / 100
		data[i]["rank"] = i + 1
	}
}

// --- internal functions ---

func buildSummary(data []map[string]interface{}, aggField string) *models.Summary {
	if aggField == "" || len(data) == 0 {
		return nil
	}

	s := &models.Summary{
		TotalRows:   len(data),
		GroupsCount: len(data),
	}

	var values []float64
	var sum float64
	for _, row := range data {
		values = append(values, toFloat(row[aggField]))
		sum += toFloat(row[aggField])
	}
	s.Sum = math.Round(sum*100) / 100
	s.Average = math.Round(sum/float64(len(values))*100) / 100

	// min / max
	minVal, maxVal := values[0], values[0]
	minGroup, maxGroup := groupLabel(data[0], aggField), groupLabel(data[0], aggField)
	for i, v := range values {
		if v < minVal {
			minVal = v
			minGroup = groupLabel(data[i], aggField)
		}
		if v > maxVal {
			maxVal = v
			maxGroup = groupLabel(data[i], aggField)
		}
	}
	s.Min = &models.GroupValue{Group: minGroup, Value: math.Round(minVal*100) / 100}
	s.Max = &models.GroupValue{Group: maxGroup, Value: math.Round(maxVal*100) / 100}

	// std deviation
	var variance float64
	for _, v := range values {
		diff := v - s.Average
		variance += diff * diff
	}
	variance /= float64(len(values))
	s.StdDeviation = math.Round(math.Sqrt(variance)*100) / 100

	return s
}

func buildDataQuality(tableName string, usedFields []string) *models.DataQuality {
	// Actual NULL counting is performed in responseWithData.go via SQL.
	// Here we return an empty structure — it is populated there.
	return &models.DataQuality{}
}

func buildInsights(s *models.Summary) []string {
	if s == nil {
		return nil
	}
	var insights []string

	if s.Max != nil {
		shareMax := 0.0
		if s.Sum > 0 {
			shareMax = s.Max.Value / s.Sum * 100
		}
		insights = append(insights, fmt.Sprintf(
			"Leader: '%s' — %.0f (%.1f%% of total)",
			s.Max.Group, s.Max.Value, shareMax,
		))
	}
	if s.Min != nil {
		shareMin := 0.0
		if s.Sum > 0 {
			shareMin = s.Min.Value / s.Sum * 100
		}
		insights = append(insights, fmt.Sprintf(
			"Bottom: '%s' — %.0f (%.1f%% of total)",
			s.Min.Group, s.Min.Value, shareMin,
		))
	}
	if s.Average > 0 && s.Max != nil {
		aboveAvg := (s.Max.Value - s.Average) / s.Average * 100
		if aboveAvg > 0 {
			insights = append(insights, fmt.Sprintf(
				"'%s' exceeds the average by %.1f%%",
				s.Max.Group, aboveAvg,
			))
		}
	}
	return insights
}

func groupLabel(row map[string]interface{}, aggField string) string {
	// Returns the first value that is NOT an aggregated field, as a string.
	// Supports string, int64, float64, and []byte — i.e., any PostgreSQL type.
	for k, v := range row {
		if k == aggField || k == "share_percent" || k == "rank" {
			continue
		}
		if v == nil {
			continue
		}
		return fmt.Sprintf("%v", v)
	}
	return "?"
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case []byte:
		f := 0.0
		fmt.Sscanf(string(val), "%f", &f)
		return f
	}
	return 0
}
