-- Seed Caretaker Pond Assignments
USE shrim_predict_db;

-- Clear old caretaker_ponds
DELETE FROM caretaker_ponds WHERE id > 0;

-- Assign ponds to caretakers
-- Maria Santos (user_id = 1): Pond 1, Pond 2
INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (1, 1), (1, 2);
UPDATE users SET pond_id = 1 WHERE id = 1;

-- Cristel Javier (user_id = 3): Pond 3, Pond 4
INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (3, 3), (3, 4);
UPDATE users SET pond_id = 3 WHERE id = 3;

-- Nicca Kate Arroyo (user_id = 4): Pond 5, Pond 6
INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (4, 5), (4, 6);
UPDATE users SET pond_id = 5 WHERE id = 4;

-- Lara Camille (user_id = 5): Pond 7
INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (5, 7);
UPDATE users SET pond_id = 7 WHERE id = 5;

-- Update assigned_caretaker_name in ponds table
UPDATE ponds SET assigned_caretaker_name = 'Maria Santos' WHERE id IN (1, 2);
UPDATE ponds SET assigned_caretaker_name = 'cristel Javier' WHERE id IN (3, 4);
UPDATE ponds SET assigned_caretaker_name = 'Nicca Kate Arroyo' WHERE id IN (5, 6);
UPDATE ponds SET assigned_caretaker_name = 'Lara camille' WHERE id IN (7);
