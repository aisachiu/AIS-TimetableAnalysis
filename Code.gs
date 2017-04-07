// -- Timetable Analysis - By achiu@ais.edu.hk --
// This app attempts to reconcile student course requests with a set timetable.
//

// -- GLOBALS --
//Get Lists from Spreadsheet
//var myListDocID = '1rFZt8Odx-dtn5k2Y5BBMXXCsXeF5OpdqFmHyZpq1KbA'; //Trial Course List File
var myListDocID = '0AkB30i6AUCFldDFfTkZwZmpOMThOOGZjZEZzVmNtNUE'; // Live Course List File Apr 2012-13 for 2013-2014 choices
var myCoursePlannerDocId = '1S6UK3WKSo_y703TLL2Rt91Ia_che6mnOBM2o1LIxXb0'; //document with data on courses for upcoming year.


var deptDefnSheet = 'Department Definition';
var courseDefnSheet = 'Course Definition 2017-18';

//Spreadsheet sheet names for Get Lists...
var myListSheetName = 'Choices';
var myCreditsSheetName = 'Transcript';
var myGradReqsSheetName = 'GradReqs';
var myStudentDataSheetName = 'StudentList';
var myCourseDefinitionSheet = 'Courses';
var myPrincipalApproverSheet = "PrincipalApprover";
//var myClassSectionDefnSheet = "Course Sections Definition";
var myClassSectionDefnSheet = "ClassSections";

//Spreadsheet for saving student choices and Teacher Recommendations. 
//var mySurveyCollector = '1LsiB1BFZgc-RjmQ0zFUw4cNvAkyz7nSnKqLmPT70tCY'; //Trial Spreadsheet 2016
var mySurveyCollector = '0AkB30i6AUCFldFVyTzY1U012cGlBT29aQTFfMHIwMmc'; //Live collector 
//var mySurveyCollector = '1waDJYP2dznf_EaY_UT_jSvlLPDYaAaoy413IknKMytQ'; //TESTING 2017


var mySurveySheetName = 'Results'; //Results sheet 
var mySurveyDraftSheetName = 'Draft Results';
//var mySurveySheetName = 'Results-V2'; //Current results sheet with 2 Adv List Choices (obsolete - moved over to "results")
var mySurveyCourseCounts = 'CourseCounts';
var myRecommendationSheetName = 'Request';
var myRequestsSheetName = 'Request';

//Get User

var thisUser = Session.getActiveUser().getEmail(); //Logged In User
//var thisUser = 'kbumpus@ais.edu.hk';
//var thisUser = 'cgray@ais.edu.hk';  // test for a HRM teacher
//var thisUser = '210135@ais.edu.hk' //Rick Wang HRM11-2


var requestActiveCol = 8;
var recActiveCol = 7;
var courseReqCol = 3;
var deptCol = 4;


/* 
* doGet - called when web URL accessed
*/
function doGet() {

// Check Permissions here if you wish to check user permissions

// Load index.html
//  var myDoc = 'Bootstrap';  
//  var myDoc = 'index'; 
  //groupSsRequests() //Run an update to the main student timetable spreadsheet first! This gets live data from approvals and requests and summarises them.
  var myDoc = 'index'
  return HtmlService.createTemplateFromFile(myDoc).evaluate().setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/* include - allows html content to be included */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

//------
// Create Unique Course IDs from Timetables
//------
function uridFromTimetable(){
  var cpSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var rsSS = SpreadsheetApp.getActiveSpreadsheet();
 
  var tempTT = cpSS.getSheetByName(myClassSectionDefnSheet).getDataRange().getValues();
  Logger.log(tempTT);
  var myTT = ss2Obj(tempTT,8,0);
  var courseDefn = cpSS.getSheetByName(courseDefnSheet).getDataRange().getValues();
  var fourYears = [{year: 9, prop:"G9"},{year: 10, prop:"G10"}, {year: 11, prop:"G11"},{year: 12, prop:"G12"}]; //The 4 years in the 4-year plan and the column in courseDefn that contains info about whether course is in that yeargroup's plan.
  var blocks = [1,2,3,4,5,6,7];
  var depts = cpSS.getSheetByName(deptDefnSheet).getDataRange().getValues();
  
  //Create an object of courses
  var courseObj = ss2Obj(courseDefn, 1,0);
  //Add classes from timetable to course Object
  for (var class in myTT){ //Loop through class section data
   if(courseObj.hasOwnProperty(myTT[class].COURSEID)){ //If class is found in courseObj
     var thisCourse = courseObj[myTT[class].COURSEID];
     if(!thisCourse.hasOwnProperty("classSections")) { //Create a class sections property and push the class to it
       thisCourse["classSections"] = [myTT[class]];
     } else {
       thisCourse["classSections"].push(myTT[class]);
     }
   }
  }
  
  //create an object for 4-year plan combinations of options
  var fourYearPlan = {}
  for(var gr in fourYears){
    fourYearPlan[fourYears[gr].year] = { grade:fourYears[gr].year, prop: fourYears[gr].prop};
    for(var d = 1; d < depts.length; d++) fourYearPlan[fourYears[gr].year][depts[d][0]] = [];
  }
  for (var course in courseObj){
    for(var gr in fourYears){
      var thisYGrp = fourYears[gr].year;
      if(courseObj[course][fourYears[gr].prop] > 0){ 
        var thisDept = courseObj[course].Department;
        if(blocks.indexOf(thisDept) > -1){
          fourYearPlan[thisYGrp][thisDept].push(course);
        }
      }
    }
  }
  
  var ssResults = ss2Obj(rsSS.getSheetByName("Valid Requests").getDataRange().getValues(),0,0);
  
  //add course choices object to student object per student
  for (var s in ssResults){
    var myChoices = ssResults[s].UniqueRequestsID.split(",");
    ssResults[s].choices = [];
    ssResults[s].valid = true;
    for (var myCourse in myChoices){
      if (courseObj.hasOwnProperty(myChoices[myCourse])){
        var pushObj= {course: myChoices[myCourse], courseSections: []};
        var myClasses = courseObj[myChoices[myCourse]].classSections;
        for (var sec in myClasses){
          pushObj.courseSections.push({class: myClasses[sec]['SECTIONCODE'], block: myClasses[sec]['BLOCK']});
        }
        ssResults[s].choices.push(pushObj);
      }
    }
  }
  
  var invalidRequests = ss2Obj(rsSS.getSheetByName("Problem Requests").getDataRange().getValues(),0,0);
  for (var s in invalidRequests){
    var myChoices = invalidRequests[s].UniqueRequestsID.split(",");
    invalidRequests[s].choices = [];
    invalidRequests[s].valid = false;
    for (var myCourse in myChoices){
      if (courseObj.hasOwnProperty(myChoices[myCourse])){
        var pushObj= {course: myChoices[myCourse], courseSections: []};
        var myClasses = courseObj[myChoices[myCourse]].classSections;
        for (var sec in myClasses){
          pushObj.courseSections.push({class: myClasses[sec]['SECTIONCODE'], block: myClasses[sec]['BLOCK']});
        }
        invalidRequests[s].choices.push(pushObj);
      }
    }
  }
  
  return {courseObj: courseObj, studentObj: ssResults, timetableObj: myTT, fourYearPlan: fourYearPlan, tt: tempTT, invalidRequests: invalidRequests};
  
}

//function object from spreadsheet - converts a spreadsheet into objects where the contents in the ID column become the key.
function ss2Obj(data, idCol, keysRow){
  var result = {};
  var keys = data[keysRow];
  for(var i=keysRow+1; i < data.length; i++){
    if (!result.hasOwnProperty(data[i][idCol])){
      result[data[i][idCol]] = {};
      for(var j in data[keysRow]){
        result[data[i][idCol]][keys[j]] = data[i][j];
        //Logger.log([data[i][idCol],i, j, keys[j], data[i][j]]);
      }
    }
  }
  return result;
}

function saveThisObject(obj) {
  var saveData = [];
  for (var i in obj){
    saveData.push([i, obj[i]]);
  }
  SpreadsheetApp.getActiveSpreadsheet().insertSheet().getRange(1,1,saveData.length, saveData[0].length).setValues(saveData);
}


function spliceCheck(){
  var courseKey = ["A","B","C"]; 
  courseKey.splice(0,1)
  Logger.log(courseKey);
}


function trialrecursive(){
  var courseKey = ["A","B","C"];  // represents a student's choices
  var courseObj = { A: {course: "A", courseSections: [{class:"A.01", block: 1},{class:"A.02", block: 3}]},
                    B: {course: "B", courseSections: [{class:"B.01", block: 2},{class:"B.02", block: 2}]},  
                    C: {course: "C", courseSections: [{class:"C.01", block: 3},{class:"C.02", block: 1}]} };
  var blocks = [1,2,3];                    
  var myFinalResult =[];
  var result = checkNext(courseKey, blocks, [], myFinalResult, courseObj);
  
}

function checkNext(courseKey, blocks, temp, final, courseObj){
  if (courseKey.length == 0) return {found: true, result: final};
  var thisCourse = courseObj[courseKey[0]];
  for (var class in thisCourse){
    var thisIndex = blocks.indexOf(class.block);
    if( thisIndex > -1) {
      blocks[thisIndex] = class.class;
      courseKey.splice(0,1); //remove this course from the courseKey.
      var CN = checkNext(courseKey, blocks, temp, final, courseObj);

        
    } else {
      return {found: false, result: final}
    } 
  }
}

function recursion2Base (){
  var courseObj = [{course: "A", courseSections: [{class:"A.01", block: 2},{class:"A.02", block: 2}]},
                   {course: "B", courseSections: [{class:"B.01", block: 2},{class:"B.02", block: 2}]},  
                   {course: "C", courseSections: [{class:"C.01", block: 2},{class:"C.02", block: 2}]}];
  var result = recursion2(courseObj);
  Logger.log(result);

}


function recursion2(courseObj){
  var returnVal = [];
  var current = courseObj.pop();
  var combinations = courseObj.length > 0 ? recursion2(courseObj) : [["", "", ""]];
  for (var section in current.courseSections){
    var sectionBlock = current.courseSections[section].block;
    for (var combo in combinations){
      var thisCombo = combinations[combo].slice(0);
      var conflict = false;
      for (var bl = 1; bl <= 3; bl++){
        if (bl == sectionBlock) {
          if (thisCombo[bl-1] != ""){
            conflict = true;
            break;
          } else {
            thisCombo[bl-1] = current.courseSections[section].class;
          }
        }
      }
      if (!conflict) {
        returnVal.push(thisCombo);
      }
    }
  }
  return returnVal;
}

function saveStudentObject(studentObj) {
  var output = [];
  var sO = JSON.parse(studentObj);
  var max = 0;
  for(var obj in sO){
    var thisRow = [];
    thisRow.push(obj);
    for(var prop in sO[obj]){
      thisRow.push(sO[obj][prop].toString());
    }
    if (thisRow.length > max) max = thisRow.length;
    output.push(thisRow);
  }
  for(var x in output){
    for (var y=0; y < max; y++){
      if (output[x][y] == undefined) output[x][y] = "";
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().insertSheet().getRange(1,1,output.length, output[0].length).setValues(output);
  return true;
}








//-----
//ORIGINAL FUNCTIONS FOR SPREADSHEET

// Function groupValidSsRequests - goes through and generates a list of VALID requests using the following rules
//  - The request must be approved
//  - If MAC5C is chose, it is broken into MAC51 and MAC52. All students must therefore have made 7 valid choices
//
function groupValidSsRequests() {
  
  var surveySS = SpreadsheetApp.openById(mySurveyCollector);
  var courseSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var listSS = SpreadsheetApp.openById(myListDocID);

  //Get all student data
  var allStudentInfo = listSS.getSheetByName(myStudentDataSheetName).getDataRange().getValues();
  var studentInfo = ArrayLib.filterByValue(allStudentInfo, 7, true);

//Get all request data  
  var requests = surveySS.getSheetByName(myRequestsSheetName).getDataRange().getValues();
  
  var myOutput = []; //will store data and write back to spreadsheet;
  var myProblemOutput = [];
  myOutput.push(["Student ID","Student Email","HRM","Given Name","Last Name","TotalRequests","UniqueRequestsID","ENGCredits","MathCredits","ScienceCredits","HumanitiesCredits","World Language","PE Credits","VPA Credits","CS Credits","Elective Credits","MAC5C"]);  
  myProblemOutput.push(["Student ID","Student Email","HRM","Given Name","Last Name","TotalRequests","UniqueRequestsID","ENGCredits","MathCredits","ScienceCredits","HumanitiesCredits","World Language","PE Credits","VPA Credits","CS Credits","Elective Credits","MAC5C","Unapproved Classes","Problem - Unapproved","Not enough Credits"]);
  
  var startRow = 72;
  var requestsObject = createRequestsObject(requests, requestActiveCol); //Puts all requests into an object, Student IDs as keys, requests as arrays under the studentID.
    
  for (var s = startRow; s < studentInfo.length ; s++){
    var thisStudentID = studentInfo[s][0];
    var myDeptsCounts = [0,0,0,0,0,0,0,0,0,0];
    var totalRequest = 0;
    var myCourses = [];
    var unapprovedCourses = [];
    var problem_Unapproved = false;
    var problem_RequestNumber = false;
    if (requestsObject.hasOwnProperty(thisStudentID)){ //Students has made requests
      var hasMAC5C = false;
      var myRequests = requestsObject[thisStudentID];
      for (var r=0; r < myRequests.length; r++){ //loop through each of this student's requests
        if(myRequests[r][recActiveCol] == true){ //if this request has been approved
          myDeptsCounts[myRequests[r][deptCol]]++;
          if(myRequests[r][courseReqCol] == 'MAC5C') { //if MAC5C is chosen, add MAC51 and MAC52
            myCourses.push('MAC51');
            myCourses.push('MAC52');
            myDeptsCounts[myRequests[r][deptCol]]++; // add an extra credit to Math column.
            hasMAC5C = true;
          } else { //if it is any course other than MAC5C, add the course to the request list.
            myCourses.push(myRequests[r][courseReqCol]);
          }
        } else {
          problem_Unapproved = true;
          unapprovedCourses.push(myRequests[r][courseReqCol]);
        }
      }
      totalRequest = myCourses.length;
    }
    if (totalRequest != 7) problem_RequestNumber = true;
    var myURID = "";
    myCourses.sort();
    for (var c=0; c < myCourses.length; c++) { myURID += myCourses[c]+"," }
    
    
    if (problem_RequestNumber || problem_Unapproved){ //if Problems, write to problem sheet
      myProblemOutput.push([studentInfo[s][0],studentInfo[s][1],studentInfo[s][2],studentInfo[s][3],studentInfo[s][4],totalRequest,myURID,myDeptsCounts[1],myDeptsCounts[2],myDeptsCounts[3],myDeptsCounts[4],myDeptsCounts[5],myDeptsCounts[6],myDeptsCounts[7],myDeptsCounts[8],myDeptsCounts[9], hasMAC5C, unapprovedCourses.toString(),problem_Unapproved, problem_RequestNumber]);
    } else { //if no problems, write to main output sheet.
      myOutput.push([studentInfo[s][0],studentInfo[s][1],studentInfo[s][2],studentInfo[s][3],studentInfo[s][4],totalRequest,myURID,myDeptsCounts[1],myDeptsCounts[2],myDeptsCounts[3],myDeptsCounts[4],myDeptsCounts[5],myDeptsCounts[6],myDeptsCounts[7],myDeptsCounts[8],myDeptsCounts[9], hasMAC5C]);
    }
  }
  SpreadsheetApp.getActive().getSheetByName('Valid Requests').clear().getRange(1, 1, myOutput.length, myOutput[0].length).setValues(myOutput);
  SpreadsheetApp.getActive().getSheetByName('Problem Requests').clear().getRange(1, 1, myProblemOutput.length, myProblemOutput[0].length).setValues(myProblemOutput);
}

//Groups the requests sheet into an object
function createRequestsObject(requests, col){
  var myObject = {};

  for (var i=0; i < requests.length; i++){
    var thisSsId = requests[i][1]; //this student ID
    
    if (requests[i][col]) {
      if (!myObject.hasOwnProperty(thisSsId)) myObject[thisSsId] = [];
      myObject[thisSsId].push(requests[i]);
    }
  }
  
  return myObject;
}


//Get all students' requests into 1 row for analysis
function groupSsRequests() {
  
  var surveySS = SpreadsheetApp.openById(mySurveyCollector);
  var courseSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var listSS = SpreadsheetApp.openById(myListDocID);

  //Get all student data
  var studentInfo = listSS.getSheetByName(myStudentDataSheetName).getDataRange().getValues();

//Get all request data  
  var requests = surveySS.getSheetByName(myRequestsSheetName).getDataRange().getValues();
  
  var myOutput = []; //will store data and write back to spreadsheet;
  
  var startRow = 72;
  var requestsObject = createRequestsObject(requests, requestActiveCol); //Puts all requests into an object, Student IDs as keys, requests as arrays under the studentID.
    
  for (var s = startRow; s < studentInfo.length ; s++){
    var thisStudentID = studentInfo[s][0];
    var myDeptsCounts = [0,0,0,0,0,0,0,0,0,0];
    var totalRequest = 0;
    var myCourses = [];
    if (requestsObject.hasOwnProperty(thisStudentID)){ //Students has made requests
      var hasMAC5C = false;
      var myRequests = requestsObject[thisStudentID];
      for (var r=0; r < myRequests.length; r++){ //loop through each of this student's requests
        myDeptsCounts[myRequests[r][deptCol]]++;
        myCourses.push(myRequests[r][courseReqCol]);
        if(myRequests[r][courseReqCol] == 'MAC5C') hasMAC5C = true;
      }
      totalRequest = myRequests.length;
    }
    var myURID = "";
    myCourses.sort();
    for (var c=0; c < myCourses.length; c++) { myURID += myCourses[c]+"," }
   myOutput.push([studentInfo[s][0],studentInfo[s][1],studentInfo[s][2],studentInfo[s][3],studentInfo[s][4],totalRequest,myURID,myDeptsCounts[1],myDeptsCounts[2],myDeptsCounts[3],myDeptsCounts[4],myDeptsCounts[5],myDeptsCounts[6],myDeptsCounts[7],myDeptsCounts[8],myDeptsCounts[9], hasMAC5C]);
  
  }
  SpreadsheetApp.getActive().getSheetByName('EachStudent').getRange(3, 1, myOutput.length, myOutput[0].length).setValues(myOutput);
}

//Groups the requests sheet into an object
function createRequestsObject(requests, col){
  var myObject = {};

  for (var i=0; i < requests.length; i++){
    var thisSsId = requests[i][1]; //this student ID
    
    if (requests[i][col]) {
      if (!myObject.hasOwnProperty(thisSsId)) myObject[thisSsId] = [];
      myObject[thisSsId].push(requests[i]);
    }
  }
  
  return myObject;
}


//Get all students' approvals into 1 row for analysis
function groupSsApprovals() {

  var surveySS = SpreadsheetApp.openById(mySurveyCollector);
  var courseSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var listSS = SpreadsheetApp.openById(myListDocID);

  //Get all student data
  var studentInfo = listSS.getSheetByName(myStudentDataSheetName).getDataRange().getValues();

//Get all request data  
  var requests = surveySS.getSheetByName(myRequestsSheetName).getDataRange().getValues();
  
  var myOutput = []; //will store data and write back to spreadsheet;
  
  var startRow = 72;
  var requestsObject = createRequestsObject(requests, recActiveCol); //Puts all requests into an object, Student IDs as keys, requests as arrays under the studentID.
    
  for (var s = startRow; s < studentInfo.length ; s++){
    var thisStudentID = studentInfo[s][0];
    var myDeptsCounts = [0,0,0,0,0,0,0,0,0,0];
    var totalRequest = 0;
    var myCourses = [];
    if (requestsObject.hasOwnProperty(thisStudentID)){ //Students has made requests
      var myRequests = requestsObject[thisStudentID];
      for (var r=0; r < myRequests.length; r++){ //loop through each of this student's requests
        myDeptsCounts[myRequests[r][deptCol]]++;
        myCourses.push(myRequests[r][courseReqCol]);
      }
      totalRequest = myRequests.length;
    }
    var myURID = "";
    myCourses.sort();
    for (var c=0; c < myCourses.length; c++) { myURID += myCourses[c]+", " }
   myOutput.push([studentInfo[s][0],studentInfo[s][1],studentInfo[s][2],studentInfo[s][3],studentInfo[s][4],totalRequest,myURID,myDeptsCounts[1],myDeptsCounts[2],myDeptsCounts[3],myDeptsCounts[4],myDeptsCounts[5],myDeptsCounts[6],myDeptsCounts[7],myDeptsCounts[8],myDeptsCounts[9]]);
  
  }
  SpreadsheetApp.getActive().getSheetByName('ActiveApprovals').getRange(3, 1, myOutput.length, myOutput[0].length).setValues(myOutput);
}


//Get all students' requests into 1 row for analysis
function findTooManyRequests() {

  
  var surveySS = SpreadsheetApp.openById(mySurveyCollector);
  var courseSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var listSS = SpreadsheetApp.openById(myListDocID);

  //Get all student data
  var studentInfo = listSS.getSheetByName(myStudentDataSheetName).getDataRange().getValues();

//Get all request data  
  var requests = surveySS.getSheetByName(myRequestsSheetName).getDataRange().getValues();
  
  var myOutput = []; //will store data and write back to spreadsheet;
  
  var startRow = 72;
  var requestsObject = createRequestsObject(requests, requestActiveCol); //Puts all requests into an object, Student IDs as keys, requests as arrays under the studentID.
    
  for (var s = startRow; s < studentInfo.length ; s++){
    var thisStudentID = studentInfo[s][0];
    var myDeptsCounts = [0,0,0,0,0,0,0,0,0,0];
    var totalRequest = 0;
    var myCourses = [];
    if (requestsObject.hasOwnProperty(thisStudentID)){ //Students has made requests
      var myRequests = requestsObject[thisStudentID];
      var MAC5CFound = false;
      var APorAWFound = false;
      for (var r=0; r < myRequests.length; r++){ //loop through each of this student's requests
        myDeptsCounts[myRequests[r][deptCol]]++;
        if(myRequests[r][courseReqCol] == "MAC5C") MAC5CFound = true;
        if(myRequests[r][courseReqCol] == "AWS5E") APorAWFound = true;
        if(myRequests[r][courseReqCol] == "APS5E") APorAWFound = true;        
        myCourses.push(myRequests[r][courseReqCol]);
      }
      totalRequest = myRequests.length;
    }
    var myURID = "";
    myCourses.sort();
    for (var c=0; c < myCourses.length; c++) { myURID += myCourses[c] }
    if (APorAWFound && MAC5CFound){
       myOutput.push([studentInfo[s][0],studentInfo[s][1],studentInfo[s][2],studentInfo[s][3],studentInfo[s][4],totalRequest,myURID,myDeptsCounts[1],myDeptsCounts[2],myDeptsCounts[3],myDeptsCounts[4],myDeptsCounts[5],myDeptsCounts[6],myDeptsCounts[7],myDeptsCounts[8],myDeptsCounts[9]]);
    }
  
  }
  SpreadsheetApp.getActive().getSheetByName('TooManyRequests').getRange(3, 1, myOutput.length, myOutput[0].length).setValues(myOutput);
}

//Groups the requests sheet into an object
function createRequestsObject(requests, col){
  var myObject = {};

  for (var i=0; i < requests.length; i++){
    var thisSsId = requests[i][1]; //this student ID
    
    if (requests[i][col]) {
      if (!myObject.hasOwnProperty(thisSsId)) myObject[thisSsId] = [];
      myObject[thisSsId].push(requests[i]);
    }
  }
  
  return myObject;
}


//Get all students' requests into 1 row for analysis
function groupSsCourseCodes() {

//var exportSheetId = '1RicH1GEx4PtDDRsVm_Cc9yLoPhwJ8kC7TWVAdE1w84U' //Original export for steven and Jeffrey
  var exportSheetId ='1d_c6pKINv2yeKJVTPccG4gvfgo3ON3OA1TU9PDEa1eM';
  var surveySS = SpreadsheetApp.openById(mySurveyCollector);
  var courseSS = SpreadsheetApp.openById(myCoursePlannerDocId);
  var listSS = SpreadsheetApp.openById(myListDocID);
  

  //Get all student data
  var studentInfo = listSS.getSheetByName(myStudentDataSheetName).getDataRange().getValues();

//Get all request data  
  var requests = surveySS.getSheetByName(myRequestsSheetName).getDataRange().getValues();
  
  var myOutput = []; //will store data and write back to spreadsheet;
  
  var startRow = 72;
  var requestsObject = createRequestsObject(requests, requestActiveCol); //Puts all requests into an object, Student IDs as keys, requests as arrays under the studentID.
    
  for (var s = startRow; s < studentInfo.length ; s++){
    var thisStudentID = studentInfo[s][0];
    var myDeptsCounts = [0,0,0,0,0,0,0,0,0,0];
    var totalRequest = 0;
    var myCourses = [];
    if (requestsObject.hasOwnProperty(thisStudentID)){ //Students has made requests
      var hasMAC5C = false;
      var myRequests = requestsObject[thisStudentID];
      for (var r=0; r < myRequests.length; r++){ //loop through each of this student's requests
        myDeptsCounts[myRequests[r][deptCol]]++;
        myCourses.push(myRequests[r][courseReqCol]);
        if(myRequests[r][courseReqCol] == 'MAC5C') hasMAC5C = true;
      }
      totalRequest = myRequests.length;
    }
    var myURID = "";
    myCourses.sort();
    for (var c=0; c < myCourses.length; c++) { myURID += myCourses[c] }
   myOutput.push([totalRequest,myURID]);
  
  }
  SpreadsheetApp.openById(exportSheetId).insertSheet('Output '+new Date()).getRange(1, 1, myOutput.length, myOutput[0].length).setValues(myOutput);

}

//Groups the requests sheet into an object
function createRequestsObject(requests, col){
  var myObject = {};

  for (var i=0; i < requests.length; i++){
    var thisSsId = requests[i][1]; //this student ID
    
    if (requests[i][col]) {
      if (!myObject.hasOwnProperty(thisSsId)) myObject[thisSsId] = [];
      myObject[thisSsId].push(requests[i]);
    }
  }
  
  return myObject;
}



function tryReduce(){

  var k = ["","a","a","HEI5C.02","a","ELG5C.01","CTD3C.02"];
  var j = k.reduce(function (ttl, x){
    return ttl + (x !== "")},0);
    
  Logger.log(j);
  

}