/*
 * Edge Limit Enforcement System
 * 
 * Purpose:
 * This system enforces rules about how nodes can be connected in our graph,
 * ensuring that nodes can only receive a specific number of incoming connections
 * based on their type. This is crucial for maintaining valid graph structures
 * in our shader/material editor.
 */

-- Defines the maximum number of incoming edges each node type can receive
CREATE OR REPLACE FUNCTION get_max_target_edges(node_type TEXT, node_data JSONB DEFAULT NULL) 
RETURNS INTEGER AS $$
BEGIN
  -- First check for texture subtypes that need multiple inputs
  IF node_type = 'texture' AND node_data IS NOT NULL THEN
    IF node_data->>'type' = 'Displace' THEN
      RETURN 2; -- Displace nodes need 2 inputs
    ELSIF node_data->>'type' = 'Add' THEN
      RETURN 2; -- Add nodes need 2 inputs
    END IF;
  END IF;

  -- Fall back to basic type rules
  RETURN CASE node_type
    -- Geometry nodes can only receive 1 input (e.g., from another geometry operation)
    WHEN 'geometry' THEN 1
    -- Material nodes are endpoints and cannot receive inputs
    WHEN 'material' THEN 0
    -- Texture nodes can only receive 1 input (e.g., from a transformation)
    WHEN 'texture' THEN 1
    -- AI nodes cannot receive inputs
    WHEN 'flux' THEN 0
    -- Window nodes can receive one input
    WHEN 'window' THEN 1
    -- Default to 0 for safety with unknown node types
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;


-- Enforces the edge limits by running before any edge creation/update
CREATE OR REPLACE FUNCTION enforce_edge_limit() 
RETURNS TRIGGER AS $$
DECLARE
  max_edges INTEGER;
  current_edges INTEGER;
  node_type TEXT;
  node_data JSONB;
  target_id VARCHAR;
BEGIN
  -- Figure out which node we're connecting to
  IF TG_OP = 'UPDATE' THEN
    target_id := NEW."target";
  ELSE
    target_id := NEW."target";
  END IF;

  -- Look up the type and data of node we're connecting to
  SELECT "type", "data" INTO node_type, node_data
  FROM "node" 
  WHERE "id" = target_id;

  -- Safety check: ensure the target node exists
  IF node_type IS NULL THEN
    RAISE EXCEPTION 'Node type not found for target ID %', target_id;
  END IF;

  -- Get the maximum allowed connections for this type and data
  SELECT get_max_target_edges(node_type, node_data) INTO max_edges;

  -- Count how many connections this node already has
  SELECT COUNT(*) INTO current_edges 
  FROM "edge" 
  WHERE "target" = target_id;

  -- Adjust counts based on operation type
  IF TG_OP = 'INSERT' THEN
    current_edges := current_edges + 1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only adjust count if we're changing which node we're targeting
    IF OLD."target" <> NEW."target" THEN
      current_edges := current_edges + 1;
    END IF;
  END IF;

  -- Prevent the operation if it would exceed the limit
  IF current_edges > max_edges THEN
    RAISE EXCEPTION 'Maximum number of edges (%) exceeded for node type %', 
      max_edges, node_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the enforcement trigger to the edge table
CREATE TRIGGER enforce_edge_limit_trigger
  BEFORE INSERT OR UPDATE ON "edge"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_edge_limit();
