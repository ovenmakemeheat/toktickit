SELECT 'CREATE DATABASE toktickit_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'toktickit_test'
)\gexec
