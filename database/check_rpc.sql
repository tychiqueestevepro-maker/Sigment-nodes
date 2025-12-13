-- Test if get_group_messages_optimized exists and returns is_system_message
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'get_group_messages_optimized'
AND routine_schema = 'public';
