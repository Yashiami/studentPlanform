package helperFunc

import (
	"fmt"
	"strings"

	"studentPlatform/models"
)

var allowedOperators = map[string]bool{
	"=": true, "!=": true, ">": true, "<": true, ">=": true, "<=": true,
	"LIKE": true, "ILIKE": true, "NOT LIKE": true,
}

var allowedOperations = map[string]bool{
	"SUM": true, "AVG": true, "COUNT": true, "MIN": true, "MAX": true,
}

var allowedDirections = map[string]bool{
	"ASC": true, "DESC": true,
}

func BuildSqlQuery(tableName string, config models.ChartConfig) (string, []interface{}, error) {
	if config.VisualizationType == "histogram" && config.BucketField != "" {
		return buildHistogramQuery(tableName, config)
	}
	return buildStandardQuery(tableName, config)
}

func buildStandardQuery(tableName string, config models.ChartConfig) (string, []interface{}, error) {
	var args []interface{}
	argIdx := 1

	var selectParts []string
	for _, g := range config.GroupBy {
		if err := ValidateIdentifier(g); err != nil {
			return "", nil, fmt.Errorf("invalid group_by field %q: %w", g, err)
		}
		selectParts = append(selectParts, fmt.Sprintf("%q", g))
	}
	for _, agg := range config.Aggregations {
		op := strings.ToUpper(agg.Operation)
		if !allowedOperations[op] {
			return "", nil, fmt.Errorf("invalid aggregation operation %q", agg.Operation)
		}
		if agg.Field == "*" {
			selectParts = append(selectParts, fmt.Sprintf("%s(*) AS %s_all", op, strings.ToLower(op)))
		} else {
			if err := ValidateIdentifier(agg.Field); err != nil {
				return "", nil, fmt.Errorf("invalid aggregation field %q: %w", agg.Field, err)
			}
			alias := strings.ToLower(op) + "_" + agg.Field
			selectParts = append(selectParts, fmt.Sprintf("%s(%q) AS %q", op, agg.Field, alias))
		}
	}
	if len(selectParts) == 0 {
		selectParts = []string{"*"}
	}

	query := fmt.Sprintf("SELECT %s FROM %q", strings.Join(selectParts, ", "), tableName)

	// Автоматично фільтруємо NULL та порожні рядки для groupBy полів —
	// вони не несуть аналітичної цінності і псують графіки.
	var whereParts []string
	for _, g := range config.GroupBy {
		whereParts = append(whereParts,
			fmt.Sprintf("%q IS NOT NULL AND %q::text <> ''", g, g),
		)
	}

	if len(config.Filters) > 0 {
		for i, f := range config.Filters {
			if err := ValidateIdentifier(f.Field); err != nil {
				return "", nil, fmt.Errorf("invalid filter field %q: %w", f.Field, err)
			}
			op := strings.ToUpper(f.Operator)
			if !allowedOperators[op] {
				return "", nil, fmt.Errorf("invalid filter operator %q", f.Operator)
			}
			condition := fmt.Sprintf("%q %s $%d", f.Field, op, argIdx)
			args = append(args, f.Value)
			argIdx++

			if i == 0 {
				whereParts = append(whereParts, condition)
			} else {
				logic := strings.ToUpper(f.Logic)
				if logic != "OR" {
					logic = "AND"
				}
				whereParts = append(whereParts, logic+" "+condition)
			}
		}
	}

	if len(whereParts) > 0 {
		query += " WHERE " + strings.Join(whereParts, " AND ")
	}

	if len(config.GroupBy) > 0 {
		var gParts []string
		for _, g := range config.GroupBy {
			gParts = append(gParts, fmt.Sprintf("%q", g))
		}
		query += " GROUP BY " + strings.Join(gParts, ", ")
	}

	if len(config.Having) > 0 {
		var havingParts []string
		for _, h := range config.Having {
			op := strings.ToUpper(h.Operation)
			if !allowedOperations[op] {
				return "", nil, fmt.Errorf("invalid having operation %q", h.Operation)
			}
			cmpOp := h.Operator
			if !allowedOperators[cmpOp] {
				return "", nil, fmt.Errorf("invalid having operator %q", h.Operator)
			}
			var aggExpr string
			if h.Field == "*" {
				aggExpr = fmt.Sprintf("%s(*)", op)
			} else {
				if err := ValidateIdentifier(h.Field); err != nil {
					return "", nil, fmt.Errorf("invalid having field %q: %w", h.Field, err)
				}
				aggExpr = fmt.Sprintf("%s(%q)", op, h.Field)
			}
			havingParts = append(havingParts, fmt.Sprintf("%s %s $%d", aggExpr, cmpOp, argIdx))
			args = append(args, h.Value)
			argIdx++
		}
		query += " HAVING " + strings.Join(havingParts, " AND ")
	}

	if len(config.OrderBy) > 0 {
		var orderParts []string
		for _, o := range config.OrderBy {
			if err := ValidateIdentifier(o.Field); err != nil {
				return "", nil, fmt.Errorf("invalid order_by field %q: %w", o.Field, err)
			}
			dir := strings.ToUpper(o.Direction)
			if !allowedDirections[dir] {
				dir = "ASC"
			}
			orderParts = append(orderParts, fmt.Sprintf("%q %s", o.Field, dir))
		}
		query += " ORDER BY " + strings.Join(orderParts, ", ")
	}

	if config.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", config.Limit)
	}
	if config.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", config.Offset)
	}

	return query, args, nil
}

func buildHistogramQuery(tableName string, config models.ChartConfig) (string, []interface{}, error) {
	if err := ValidateIdentifier(config.BucketField); err != nil {
		return "", nil, fmt.Errorf("invalid bucket_field %q: %w", config.BucketField, err)
	}
	bs := config.BucketSize
	if bs <= 0 {
		bs = 10
	}

	var args []interface{}
	argIdx := 1

	query := fmt.Sprintf(
		`SELECT FLOOR(%q / $%d) * $%d AS bucket_start, COUNT(*) AS count
		 FROM %q`,
		config.BucketField, argIdx, argIdx+1, tableName,
	)
	args = append(args, bs, bs)
	argIdx += 2

	if len(config.Filters) > 0 {
		var whereParts []string
		for i, f := range config.Filters {
			if err := ValidateIdentifier(f.Field); err != nil {
				return "", nil, fmt.Errorf("invalid filter field %q: %w", f.Field, err)
			}
			op := strings.ToUpper(f.Operator)
			if !allowedOperators[op] {
				return "", nil, fmt.Errorf("invalid filter operator %q", f.Operator)
			}
			condition := fmt.Sprintf("%q %s $%d", f.Field, op, argIdx)
			args = append(args, f.Value)
			argIdx++
			if i == 0 {
				whereParts = append(whereParts, condition)
			} else {
				logic := strings.ToUpper(f.Logic)
				if logic != "OR" {
					logic = "AND"
				}
				whereParts = append(whereParts, logic+" "+condition)
			}
		}
		query += " WHERE " + strings.Join(whereParts, " ")
	}

	query += fmt.Sprintf(` GROUP BY bucket_start ORDER BY bucket_start`)
	return query, args, nil
}
