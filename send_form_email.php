<?php
if(isset($_POST['email'])) {

    // EDIT THE 2 LINES BELOW AS REQUIRED
    $email_to = "saad@mafium.com";
    $email_subject = "website contact";
    $comments = $_POST['message']; // required
  }
    $email_message = "Form details below.\n\n";


    function clean_string($string) {
      $bad = array("content-type","bcc:","to:","cc:","href");
      return str_replace($bad,"",$string);
    }

    $email_message .= "Comments: ".clean_string($comments)."\n";

// create email headers

$headers = 'From: '.$email_to."\r\n".
'Reply-To: '.$email_to."\r\n" .
'X-Mailer: PHP/' . phpversion();

@mail($email_to, $email_subject, $email_message, $headers);
?>

<!-- include your own success html here -->

Thank you for contacting us. We will be in touch with you very soon.

<?php

}
?>
