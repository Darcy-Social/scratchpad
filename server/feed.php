<?php

$host = '127.0.0.1';
$db   = 'darcy';
$user = 'herder';
$pass = 'ianraHokwenibreeswudqueatOcJes%';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$pdo = null;
try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     throw new \PDOException($e->getMessage(), (int)$e->getCode());
}
if (!$pdo){echo';(';}

//$stmt = $pdo->query('show tables;');
//var_dump($stmt->fetchAll());
//

$data = json_decode(file_get_contents('php://input'), true);
if ($data){
        print_r($data);

        $data = json_decode(file_get_contents('php://input'), true);
        $url = @$data['url'];
        if (!$url){ header("HTTP/1.1 500 NO URL SUPPLIED"); exit; }

        $parse = parse_url($url);

        if (!@$parse['host']){ header("HTTP/1.1 500 NO VALID URL SUPPLIED"); exit; }
        $sql = 'insert into posts (domain, url, last_update, urlhash, body ) values(?,?,null, ?, ?) on duplicate key update last_update = now(), body = ?';


        $body = file_get_contents($url);
        $pdo->prepare($sql)->execute([$parse['host'], $url, hash('sha256',$url), $body, $body]);
        header("HTTP/1.1 200 OK");

        exit;
}
$sql = 'select * from posts order by id desc limit 101';
header('Content-Type: application/json');
echo json_encode($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC));